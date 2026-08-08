import { fetch as expoFetch } from "expo/fetch"
import { Platform } from "react-native"
import type { AiChatMessage, AiProviderSettings, AiToolCallInfo, StreamingChunk } from "@/types"
import type { AiToolDefinition } from "./tools"

/**
 * Minimal OpenAI-compatible streaming chat client.
 *
 * Works against any provider that speaks the OpenAI chat-completions dialect
 * (OpenAI, OpenRouter, OpenCode, Ollama, LM Studio, ...). Uses `expo/fetch` on
 * native for SSE streaming; on web, requests go through the same-origin AI
 * proxy (`/api/ai/proxy`, mounted by the Metro dev server and serve-dist.mjs)
 * because provider gateways block browser CORS.
 */

export type ChatTool = {
  type: "function"
  function: {
    name: string
    description: string
    parameters: AiToolDefinition["schema"]
  }
}

export const AI_PROXY_PREFIX = "/api/ai/proxy"

/** Providers whose gateways want the app identity headers (like OpenRouter). */
function needsAppHeaders(provider: AiProviderSettings["provider"]): boolean {
  return provider === "openrouter" || provider === "opencode"
}

/** Base URL may already be the full /chat/completions endpoint (OpenCode). */
export function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "")
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`
}

export function modelsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "")
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed.replace(/\/chat\/completions$/, "") + "/models"
  }
  return `${trimmed}/models`
}

type FetchResponseLike = Awaited<ReturnType<typeof expoFetch>>

/**
 * Fetch helper that mirrors the YAZIO web proxy pattern: native talks to the
 * provider directly, web tunnels through the same-origin AI proxy.
 */
async function aiFetch(url: string, init: RequestInit): Promise<FetchResponseLike> {
  if (Platform.OS !== "web") {
    return (await expoFetch(url, init)) as unknown as FetchResponseLike
  }
  const headers = new Headers(init.headers)
  const proxyHeaders: Record<string, string> = {
    "x-ai-target-url": url,
    "content-type": headers.get("content-type") ?? "application/json",
    accept: headers.get("accept") ?? "text/event-stream",
  }
  for (const name of ["authorization", "HTTP-Referer", "X-Title"]) {
    const value = headers.get(name)
    if (value) proxyHeaders[name] = value
  }
  const response = await fetch(AI_PROXY_PREFIX, {
    method: "POST",
    headers: proxyHeaders,
    body: typeof init.body === "string" ? init.body : undefined,
    signal: init.signal,
  })
  return response as unknown as FetchResponseLike
}

function buildHeaders(settings: AiProviderSettings): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "text/event-stream",
  }
  if (settings.api_key) {
    headers.authorization = `Bearer ${settings.api_key}`
  }
  if (needsAppHeaders(settings.provider)) {
    headers["HTTP-Referer"] = "https://github.com/tothKarolyDavid/Dietinator"
    headers["X-Title"] = "Dietinator Calorie Tracker"
  }
  return headers
}

/** Serialize internal messages into the OpenAI wire format. */
export function buildChatPayload(
  settings: AiProviderSettings,
  messages: AiChatMessage[],
  tools: AiToolDefinition[],
): Record<string, unknown> {
  const wireMessages = messages.map((message) => {
    switch (message.role) {
      case "tool":
        return {
          role: "tool",
          tool_call_id: message.tool_call_id ?? "",
          content: message.content || "",
        }
      case "assistant": {
        const base: Record<string, unknown> = { role: "assistant", content: message.content || "" }
        if (message.tool_calls?.length) {
          base.tool_calls = message.tool_calls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.arguments_json || "{}" },
          }))
          // DeepSeek-style reasoning models reject assistant tool_calls rows
          // without the reasoning field in multi-turn tool loops.
          if (settings.provider === "opencode") {
            base.reasoning_content = ""
          }
        }
        return base
      }
      default:
        return { role: message.role, content: message.content || "" }
    }
  })

  const payload: Record<string, unknown> = {
    model: settings.model,
    messages: wireMessages,
    stream: true,
  }
  if (tools.length > 0) {
    payload.tools = tools.map<ChatTool>((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.schema,
      },
    }))
  }
  return payload
}

/** Best-effort model list from the provider's /models endpoint. */
export async function fetchAvailableModels(
  settings: AiProviderSettings,
  signal?: AbortSignal,
): Promise<string[]> {
  if (!settings.api_key) return []
  try {
    const response = await aiFetch(modelsUrl(settings.base_url), {
      method: "GET",
      headers: buildHeaders(settings),
      signal,
    })
    if (!response.ok) return []
    const parsed = (await response.json()) as { data?: { id?: string }[] }
    return (parsed.data ?? []).map((m) => m.id ?? "").filter(Boolean)
  } catch {
    return []
  }
}

/** Minimal non-streaming request used by the "Test connection" button. */
export async function testProviderConnection(
  settings: AiProviderSettings,
  signal?: AbortSignal,
): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await aiFetch(chatCompletionsUrl(settings.base_url), {
      method: "POST",
      headers: buildHeaders(settings),
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 8,
        stream: false,
      }),
      signal,
    })
    if (response.ok) return { ok: true, message: "Connection works." }
    const body = await response.text().catch(() => "")
    return { ok: false, message: friendlyHttpError(response.status, parseErrorBody(body)) }
  } catch {
    return {
      ok: false,
      message: "Could not reach the provider. Check the base URL and your network.",
    }
  }
}

function friendlyHttpError(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return "The provider rejected the API key (401/403). Check it in Settings."
  }
  if (status === 404) {
    return "Endpoint or model not found (404). Check the base URL and model name."
  }
  if (status === 429) {
    return "Rate limited by the provider (429). Try again in a moment."
  }
  if (status >= 500) {
    return `The provider failed (HTTP ${status}). Try again in a moment.`
  }
  const trimmed = body.trim()
  return trimmed
    ? `Provider error (HTTP ${status}): ${trimmed.slice(0, 300)}`
    : `Provider error (HTTP ${status}).`
}

function parseErrorBody(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } }
    if (parsed.error?.message) return parsed.error.message
  } catch {
    // Not JSON — fall through to the raw body.
  }
  return raw.slice(0, 300)
}

/** Full (non-streaming) fallback for providers that ignore `stream: true`. */
function parseNonStreamingResponse(raw: string): StreamingChunk[] {
  try {
    const parsed = JSON.parse(raw) as {
      choices?: {
        message?: {
          content?: string
          tool_calls?: {
            id?: string
            function?: { name?: string; arguments?: string }
          }[]
        }
      }[]
    }
    const choice = parsed.choices?.[0]?.message
    if (!choice) return [{ error: "Empty provider response." }]
    const chunks: StreamingChunk[] = []
    if (choice.content) chunks.push({ delta: choice.content })
    const toolCalls: AiToolCallInfo[] = (choice.tool_calls ?? []).map((tc, index) => ({
      id: tc.id || `call_${index}`,
      name: tc.function?.name ?? "",
      arguments_json: tc.function?.arguments ?? "{}",
    }))
    if (toolCalls.length > 0) chunks.push({ tool_calls: toolCalls })
    return chunks
  } catch {
    return [{ error: "The provider returned an unreadable response." }]
  }
}

export function parseSseChunk(
  data: string,
  accumulator: Map<number, { id: string; name: string; args: string }>,
): StreamingChunk | null {
  if (data === "[DONE]") return null

  let parsed: {
    choices?: {
      delta?: {
        content?: string | null
        reasoning_content?: string | null
        tool_calls?: {
          index?: number
          id?: string
          function?: { name?: string; arguments?: string }
        }[]
      }
      error?: { message?: string }
    }[]
    error?: { message?: string }
  }
  try {
    parsed = JSON.parse(data)
  } catch {
    return null
  }

  const topLevelError = parsed.error
  if (topLevelError?.message) {
    return { error: topLevelError.message }
  }

  const choice = parsed.choices?.[0]
  if (choice?.error?.message) {
    return { error: choice.error.message }
  }
  const delta = choice?.delta
  if (!delta) return null

  const chunk: StreamingChunk = {}
  if (delta.reasoning_content) chunk.reasoning = delta.reasoning_content
  if (delta.content) chunk.delta = delta.content

  if (delta.tool_calls?.length) {
    const calls: AiToolCallInfo[] = []
    for (const tc of delta.tool_calls) {
      const index = tc.index ?? 0
      const current = accumulator.get(index) ?? { id: "", name: "", args: "" }
      if (tc.id) current.id = tc.id
      if (tc.function?.name) current.name = tc.function.name
      if (tc.function?.arguments) current.args += tc.function.arguments
      accumulator.set(index, current)
      calls.push({
        id: current.id || `call_${index}`,
        name: current.name,
        arguments_json: current.args || "{}",
      })
    }
    chunk.tool_calls = calls
  }

  if (chunk.delta === undefined && chunk.reasoning === undefined && !chunk.tool_calls) {
    return null
  }
  return chunk
}

export async function* streamChatCompletion(
  settings: AiProviderSettings,
  messages: AiChatMessage[],
  tools: AiToolDefinition[],
  signal?: AbortSignal,
): AsyncGenerator<StreamingChunk> {
  const url = chatCompletionsUrl(settings.base_url)

  let response: Response
  try {
    response = (await aiFetch(url, {
      method: "POST",
      headers: buildHeaders(settings),
      body: JSON.stringify(buildChatPayload(settings, messages, tools)),
      signal,
    })) as unknown as Response
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError"
    if (aborted) return
    yield { error: "Could not reach the AI provider. Check the base URL in Settings." }
    return
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    yield { error: friendlyHttpError(response.status, parseErrorBody(body)) }
    return
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("text/event-stream")) {
    const raw = await response.text().catch(() => "")
    for (const chunk of parseNonStreamingResponse(raw)) {
      yield chunk
    }
    return
  }

  const body = response.body
  if (!body) {
    yield { error: "The provider returned an empty stream." }
    return
  }

  const reader = body.getReader()
  const decoder = new TextDecoder()
  const toolAccumulator = new Map<number, { id: string; name: string; args: string }>()
  let buffer = ""

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith("data:")) continue
        const data = trimmed.slice(5).trim()
        const chunk = parseSseChunk(data, toolAccumulator)
        if (chunk) yield chunk
      }
    }
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError"
    if (!aborted) {
      yield { error: "The provider stream was interrupted." }
    }
  }
}
