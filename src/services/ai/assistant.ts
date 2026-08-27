import * as aiChatDb from "@/db/ai-chat"
import { getAiProviderSettings } from "@/db/ai-settings"
import { getSettings } from "@/db/settings"
import type { AiChatMessage, AiToolCallInfo } from "@/types"
import { toDateKey } from "@/utils/date"
import { streamChatCompletion } from "./openai-client"
import { AiToolRegistry } from "./tools"
import { createDiaryTools } from "./diary-tools"

export type PendingConfirmation = {
  call: AiToolCallInfo
  toolName: string
  description: string
  args: Record<string, unknown>
}

export type TurnCallbacks = {
  /** Fired after every mutation of the persisted message list. */
  onMessages: () => void
  /** Fired when the assistant pauses for user confirmation of destructive tools. */
  onConfirmation: (pending: PendingConfirmation[]) => void
  /** Fired when the turn ends (success, error, cancelled, or paused). */
  onTurnEnd: () => void
}

const MAX_TOOL_LOOPS = 6
const MAX_TOOL_RESULT_CHARS = 8000

let toolsRegistry: AiToolRegistry | null = null
function getToolRegistry(): AiToolRegistry {
  if (!toolsRegistry) toolsRegistry = new AiToolRegistry(createDiaryTools())
  return toolsRegistry
}

export function visibleMessages(all: AiChatMessage[]): AiChatMessage[] {
  return all.filter((m) => m.role === "user" || m.role === "assistant")
}

function truncateToolResult(json: string): string {
  if (json.length <= MAX_TOOL_RESULT_CHARS) return json
  return `${json.slice(0, MAX_TOOL_RESULT_CHARS)}\n...(truncated)`
}

async function buildSystemPrompt(): Promise<string> {
  const settings = await getSettings()
  const now = new Date()
  const customInstructions = settings.ai_system_prompt?.trim()
    ? `\n\nCustom Instructions:\n${settings.ai_system_prompt.trim()}`
    : ""
  const hh = String(now.getHours()).padStart(2, "0")
  const mm = String(now.getMinutes()).padStart(2, "0")
  return [
    "You are Dietinator AI, an assistant inside Dietinator, a local-first calorie, macro, water, and weight tracker.",
    `Current date: ${now.toISOString()} (local time ${hh}:${mm})`,
    `Daily goals: ${settings.calorie_goal} kcal, ${settings.protein_goal} g protein, ${settings.carbs_goal} g carbs, ${settings.fat_goal} g fat, ${settings.water_goal_ml || 2500} ml water.`,
    settings.target_weight_kg > 0 ? `Target weight: ${settings.target_weight_kg} kg.` : "",
    settings.height_cm > 0 ? `Height: ${settings.height_cm} cm.` : "",
    "",
    "Capabilities:",
    "- Diary: Read and summarize diary entries (get_diary_summary), get multi-day diary stats (get_diary_stats), log food (log_food), edit amount/slot (update_food_entry), delete entries (delete_food_entry).",
    "- Water: View hydration intake and goals (get_water), log water (log_water), delete water logs (delete_water_entry).",
    "- Weight and BMI: View weight logs, BMI, and trends (get_weight), record weight (log_weight), delete weight entries (delete_weight_entry).",
    "- Saved Meals: View meals and itemized ingredients (get_meals), log full meals to diary (log_meal), create/save meal templates (save_meal), delete meals (delete_meal).",
    "- Food Database and Favorites: Search database (search_foods), view favorites (get_favorite_foods), star/unstar foods (toggle_favorite_food), view recent food portions (get_recent_foods).",
    "- Profile and Goals: Read and update goals (get_goals, set_goals), read settings (get_settings), set display units (set_units), update profile (set_profile).",
    "- Analytics: Multi-day aggregated nutrition, hydration, and weight progress summary (get_health_summary).",
    "",
    "Guidelines:",
    "- Be concise, clear, encouraging and informative.",
    "- Use GitHub Markdown for structured data (tables for macros, nutrition, and summaries).",
    "- Prefer search_foods to get real nutrition before logging.",
    "- Ask the user before deleting entries; never log food the user did not ask for.",
    customInstructions,
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * Orchestrates one chat turn: streams the assistant response, executes tool
 * calls against the on-device diary, pauses for user confirmation on
 * destructive tools, and persists the full exchange (system/tool rows
 * included) so a later turn never has to re-run tools.
 */
export class AiAssistant {
  private messages: AiChatMessage[] = []
  private aborter: AbortController | null = null
  private busy = false
  private paused = false
  private pending: PendingConfirmation[] = []

  isBusy(): boolean {
    return this.busy
  }

  hasPendingConfirmation(): boolean {
    return this.pending.length > 0
  }

  getPendingConfirmation(): PendingConfirmation[] {
    return this.pending
  }

  async loadHistory(): Promise<AiChatMessage[]> {
    this.messages = await aiChatDb.getChatMessages()
    return this.messages
  }

  async clearHistory(): Promise<void> {
    this.cancel()
    this.messages = []
    await aiChatDb.clearChatMessages()
  }

  cancel(): void {
    // Abort only. The aborter itself stays set until the turn unwinds so
    // runLoop can observe signal.aborted and clean up the placeholder.
    this.aborter?.abort()
    this.paused = false
    this.pending = []
  }

  async sendMessage(text: string, callbacks: TurnCallbacks): Promise<void> {
    const prompt = text.trim()
    if (!prompt || this.busy) return

    const settings = await getAiProviderSettings()
    if (!settings.enabled) return

    this.busy = true
    this.paused = false
    const pendingToCancel = this.pending
    this.pending = []
    this.aborter = new AbortController()

    if (pendingToCancel.length > 0) {
      for (const item of pendingToCancel) {
        await this.appendToolResult(
          item.call.id,
          item.call.name,
          JSON.stringify({
            success: false,
            error: "Action superseded by new user message.",
          }),
        )
      }
    }

    await this.append({
      role: "user",
      content: prompt,
      created_at: new Date().toISOString(),
    })
    callbacks.onMessages()

    try {
      await this.ensureSystemMessage()
      await this.runLoop(callbacks)
    } finally {
      this.aborter = null
      if (this.busy) {
        this.busy = false
        callbacks.onTurnEnd()
      }
    }
  }

  /**
   * Resumes a paused turn after the user approved or declined the pending
   * destructive tool calls.
   */
  async resolveConfirmation(approved: boolean, callbacks: TurnCallbacks): Promise<void> {
    if (!this.paused || this.pending.length === 0) return

    this.paused = false
    const pending = this.pending
    this.pending = []
    callbacks.onConfirmation([])

    for (const item of pending) {
      const result = await this.executeTool(item.call.name, item.call.arguments_json, approved)
      await this.appendToolResult(item.call.id, item.call.name, result)
    }
    callbacks.onMessages()

    try {
      await this.runLoop(callbacks)
    } finally {
      if (this.busy) {
        this.busy = false
        callbacks.onTurnEnd()
      }
    }
  }

  private async ensureSystemMessage(): Promise<void> {
    const systemMessage = this.messages.find((m) => m.role === "system")
    const content = await buildSystemPrompt()
    if (systemMessage?.id) {
      await aiChatDb.updateChatMessage(systemMessage.id, { content })
      systemMessage.content = content
      return
    }
    const id = await aiChatDb.addChatMessage({
      role: "system",
      content,
      created_at: new Date().toISOString(),
    })
    this.messages.unshift({ id, role: "system", content, created_at: "" })
  }

  private async runLoop(callbacks: TurnCallbacks): Promise<void> {
    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      const assistantId = await this.appendThinkingMessage()
      callbacks.onMessages()

      const { toolCalls, error } = await this.streamResponse(assistantId, callbacks)
      if (error) {
        await aiChatDb.updateChatMessage(assistantId, { is_error: 1 })
        callbacks.onMessages()
        return
      }
      if (this.aborter?.signal.aborted) {
        // Cancelled mid-stream: drop the placeholder, keep the user message.
        await this.removeMessage(assistantId)
        callbacks.onMessages()
        return
      }

      if (toolCalls.length > 0) {
        const message = this.messages.find((m) => m.id === assistantId)
        if (message) message.tool_calls = toolCalls
        await aiChatDb.updateChatMessage(assistantId, { tool_calls: toolCalls })
      }

      const resolvedCalls = toolCalls.filter((call) => call.name.trim() !== "")
      if (resolvedCalls.length === 0) {
        return // final answer
      }

      const pending: PendingConfirmation[] = []
      for (const call of resolvedCalls) {
        const tool = getToolRegistry().get(call.name)
        if (!tool) {
          const result = JSON.stringify({
            success: false,
            error: `Tool '${call.name}' does not exist.`,
          })
          await this.appendToolResult(call.id, call.name, result)
        } else if (tool.destructive) {
          pending.push({
            call,
            toolName: tool.name,
            description: tool.description,
            args: parseToolArgs(call.arguments_json),
          })
        } else {
          const result = await this.executeTool(call.name, call.arguments_json, true)
          await this.appendToolResult(call.id, call.name, result)
        }
      }

      if (pending.length > 0) {
        this.paused = true
        this.pending = pending
        callbacks.onConfirmation(pending)
        return
      }
      callbacks.onMessages()
    }

    // Loop budget exhausted. Report it and give the model one final turn.
    const finalId = await this.appendThinkingMessage()
    callbacks.onMessages()
    await this.appendToolResult(
      "loop-budget",
      "internal",
      JSON.stringify({
        success: false,
        error: "Reached the maximum number of tool steps.",
      }),
    )
    await this.streamResponse(finalId, callbacks)
  }

  private async streamResponse(
    messageId: number,
    callbacks: TurnCallbacks,
  ): Promise<{ toolCalls: AiToolCallInfo[]; error: string | null }> {
    const settings = await getAiProviderSettings()
    const toolCalls: AiToolCallInfo[] = []
    let content = ""
    let reasoning = ""

    const stream = streamChatCompletion(
      settings,
      this.messages,
      getToolRegistry().getAll(),
      this.aborter?.signal,
    )
    for await (const chunk of stream) {
      if (chunk.error) {
        return { toolCalls, error: chunk.error }
      }
      if (chunk.reasoning) {
        reasoning += chunk.reasoning
        await aiChatDb.updateChatMessage(messageId, { reasoning })
        callbacks.onMessages()
      }
      if (chunk.delta) {
        content += chunk.delta
        await aiChatDb.updateChatMessage(messageId, { content })
        callbacks.onMessages()
      }
      for (const call of chunk.tool_calls ?? []) {
        const existing = toolCalls.find((c) => c.id === call.id)
        if (existing) {
          existing.arguments_json = call.arguments_json
          if (call.name) existing.name = call.name
        } else {
          toolCalls.push({ ...call })
        }
      }
    }
    return { toolCalls, error: null }
  }

  private async executeTool(
    name: string,
    argumentsJson: string,
    approved: boolean,
  ): Promise<string> {
    if (!approved) {
      return JSON.stringify({
        success: false,
        error: "The user declined this action. No changes were made.",
      })
    }
    const tool = getToolRegistry().get(name)
    if (!tool) {
      return JSON.stringify({ success: false, error: `Tool '${name}' does not exist.` })
    }
    try {
      const result = await tool.execute(parseToolArgs(argumentsJson))
      return truncateToolResult(JSON.stringify(result))
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Tool execution failed.",
      })
    }
  }

  private async appendToolResult(
    callId: string,
    toolName: string,
    resultJson: string,
  ): Promise<void> {
    await this.append({
      role: "tool",
      content: resultJson,
      tool_call_id: callId,
      tool_name: toolName,
      created_at: new Date().toISOString(),
    })
  }

  private async appendThinkingMessage(): Promise<number> {
    const id = await aiChatDb.addChatMessage({
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    })
    this.messages.push({ id, role: "assistant", content: "", created_at: "" })
    return id
  }

  private async append(message: AiChatMessage): Promise<void> {
    const id = await aiChatDb.addChatMessage(message)
    this.messages.push({ ...message, id })
  }

  private async removeMessage(id: number): Promise<void> {
    this.messages = this.messages.filter((m) => m.id !== id)
    await aiChatDb.deleteChatMessage(id)
  }
}

function parseToolArgs(json: string): Record<string, unknown> {
  if (!json?.trim()) return {}
  try {
    const parsed = JSON.parse(json) as unknown
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export { toDateKey }
