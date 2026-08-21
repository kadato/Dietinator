import * as aiChatDb from "@/db/ai-chat"
import * as aiSettingsDb from "@/db/ai-settings"
import * as settingsDb from "@/db/settings"
import { streamChatCompletion } from "../openai-client"
import { AiAssistant, visibleMessages, type TurnCallbacks } from "../assistant"
import type { AiChatMessage, AiProviderSettings, StreamingChunk } from "@/types"

jest.mock("@/db/ai-chat", () => ({
  getChatMessages: jest.fn(),
  addChatMessage: jest.fn(),
  updateChatMessage: jest.fn(),
  deleteChatMessage: jest.fn(),
  clearChatMessages: jest.fn(),
}))

jest.mock("@/db/diary", () => ({
  getDiaryEntriesForDate: jest.fn().mockResolvedValue([]),
  getDiaryEntryCount: jest.fn().mockResolvedValue(0),
  getDiaryEntryById: jest.fn().mockResolvedValue(null),
  addDiaryEntry: jest.fn().mockResolvedValue(undefined),
  removeDiaryEntry: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/db/ai-settings", () => ({
  getAiProviderSettings: jest.fn(),
}))

jest.mock("@/db/settings", () => ({
  getSettings: jest.fn(),
}))

jest.mock("../openai-client", () => ({
  streamChatCompletion: jest.fn(),
}))

jest.mock("@/db/food-cache", () => ({ searchLocalFoods: jest.fn().mockResolvedValue([]) }))
jest.mock("@/services/yazio/foods", () => ({
  searchFoodsRemote: jest.fn().mockRejectedValue(new Error("offline")),
}))
jest.mock("@/services/diary", () => ({
  updateDiaryEntry: jest.fn().mockResolvedValue(null),
}))
jest.mock("@/services/meals", () => ({
  listMeals: jest.fn().mockResolvedValue([]),
  mealTotals: jest.fn(() => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 })),
  logMealToDiary: jest.fn().mockResolvedValue({ logged: 1, skipped: [] }),
}))

const mockAddMessage = aiChatDb.addChatMessage as jest.MockedFunction<
  typeof aiChatDb.addChatMessage
>
const mockUpdateMessage = aiChatDb.updateChatMessage as jest.MockedFunction<
  typeof aiChatDb.updateChatMessage
>
const mockDeleteMessage = aiChatDb.deleteChatMessage as jest.MockedFunction<
  typeof aiChatDb.deleteChatMessage
>
const mockGetSettings = settingsDb.getSettings as jest.MockedFunction<typeof settingsDb.getSettings>
const mockGetAiSettings = aiSettingsDb.getAiProviderSettings as jest.MockedFunction<
  typeof aiSettingsDb.getAiProviderSettings
>
const mockStream = streamChatCompletion as jest.MockedFunction<typeof streamChatCompletion>

const providerSettings: AiProviderSettings = {
  enabled: true,
  provider: "openai",
  base_url: "https://api.openai.com/v1",
  api_key: "sk-test",
  model: "gpt-4o-mini",
  system_prompt: "",
}

const settingsRow = {
  calorie_goal: 2000,
  protein_goal: 150,
  carbs_goal: 200,
  fat_goal: 65,
  units: "metric",
  yazio_sync_enabled: 0,
  food_database_country: "",
  update_check_enabled: 1,
  ai_enabled: 0,
  ai_provider: "openai" as const,
  ai_base_url: "",
  ai_model: "",
  ai_system_prompt: "",
  agent_bridge_rev: 0,
  theme_preference: "system" as const,
  water_goal_ml: 2500,
  height_cm: 0,
  target_weight_kg: 0,
}

async function* chunksOf(chunks: StreamingChunk[]): AsyncGenerator<StreamingChunk> {
  for (const chunk of chunks) yield chunk
}

function makeCallbacks() {
  const callbacks: TurnCallbacks & {
    messagesCount: number
    confirmations: unknown[]
    turnEnds: number
  } = {
    messagesCount: 0,
    confirmations: [],
    turnEnds: 0,
    onMessages: () => callbacks.messagesCount++,
    onConfirmation: (pending) => callbacks.confirmations.push(pending),
    onTurnEnd: () => callbacks.turnEnds++,
  }
  return callbacks
}

describe("AiAssistant", () => {
  let seq: number

  beforeEach(() => {
    jest.clearAllMocks()
    seq = 1
    mockAddMessage.mockImplementation(async (message: AiChatMessage) => seq++)
    mockUpdateMessage.mockResolvedValue(undefined)
    mockDeleteMessage.mockResolvedValue(undefined)
    mockGetSettings.mockResolvedValue(settingsRow)
    mockGetAiSettings.mockResolvedValue(providerSettings)
  })

  it("streams a plain answer and persists user + assistant messages", async () => {
    mockStream.mockImplementation(async function* () {
      yield* chunksOf([{ delta: "Hi" }, { delta: " there" }])
    })

    const assistant = new AiAssistant()
    const callbacks = makeCallbacks()
    await assistant.sendMessage("hello", callbacks)

    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: "user", content: "hello" }),
    )
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: "assistant", content: "" }),
    )
    expect(mockUpdateMessage).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ content: "Hi" }),
    )
    expect(mockUpdateMessage).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ content: "Hi there" }),
    )
    expect(callbacks.turnEnds).toBe(1)
    expect(assistant.isBusy()).toBe(false)
  })

  it("runs non-destructive tools and continues the loop", async () => {
    mockStream
      .mockImplementationOnce(async function* () {
        yield* chunksOf([
          {
            tool_calls: [
              {
                id: "call-1",
                name: "get_diary_summary",
                arguments_json: '{"date":"2026-08-08"}',
              },
            ],
          },
        ])
      })
      .mockImplementationOnce(async function* () {
        yield* chunksOf([{ delta: "You have 200 kcal." }])
      })

    const assistant = new AiAssistant()
    const callbacks = makeCallbacks()
    await assistant.sendMessage("summary", callbacks)

    // tool call, then tool result (from the mocked diary DB), then final answer
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: "tool", tool_call_id: "call-1" }),
    )
    expect(mockUpdateMessage).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ content: "You have 200 kcal." }),
    )
    expect(callbacks.confirmations).toEqual([])
  })

  it("pauses for confirmation on destructive tools and resumes on approval", async () => {
    mockStream
      .mockImplementationOnce(async function* () {
        yield* chunksOf([
          {
            tool_calls: [
              {
                id: "call-2",
                name: "log_food",
                arguments_json: '{"name":"Oats","kcal":250}',
              },
            ],
          },
        ])
      })
      .mockImplementationOnce(async function* () {
        yield* chunksOf([{ delta: "Logged!" }])
      })

    const assistant = new AiAssistant()
    const callbacks = makeCallbacks()
    await assistant.sendMessage("log oats", callbacks)

    expect(callbacks.confirmations).toHaveLength(1)
    expect((callbacks.confirmations[0] as { toolName: string }[])[0].toolName).toBe("log_food")
    expect(assistant.hasPendingConfirmation()).toBe(true)

    await assistant.resolveConfirmation(true, callbacks)

    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: "tool", tool_call_id: "call-2" }),
    )
    expect(mockUpdateMessage).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ content: "Logged!" }),
    )
    expect(assistant.hasPendingConfirmation()).toBe(false)
  })

  it("reports a declined confirmation back to the model", async () => {
    mockStream.mockImplementation(async function* () {
      yield* chunksOf([
        {
          tool_calls: [
            { id: "call-3", name: "delete_food_entry", arguments_json: '{"entry_id":"e1"}' },
          ],
        },
      ])
    })

    const assistant = new AiAssistant()
    const callbacks = makeCallbacks()
    await assistant.sendMessage("delete e1", callbacks)

    await assistant.resolveConfirmation(false, callbacks)

    const toolResult = mockAddMessage.mock.calls.find((call) => call[0].role === "tool")?.[0]
    expect(toolResult?.content).toContain("declined")
  })

  it("marks the assistant message as error when the stream reports one", async () => {
    mockStream.mockImplementation(async function* () {
      yield* chunksOf([{ error: "Provider exploded" }])
    })

    const assistant = new AiAssistant()
    const callbacks = makeCallbacks()
    await assistant.sendMessage("hi", callbacks)

    expect(mockUpdateMessage).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ is_error: 1 }),
    )
  })

  it("drops the placeholder when cancelled mid-stream but keeps the user message", async () => {
    mockStream.mockImplementation(async function* (
      _settings: AiProviderSettings,
      _messages: AiChatMessage[],
      _tools: unknown[],
      signal?: AbortSignal,
    ) {
      yield* chunksOf([{ delta: "partial" }])
      // Hold the stream open until the assistant aborts it.
      await new Promise<void>((resolve) => {
        signal?.addEventListener("abort", () => resolve())
      })
    })

    const assistant = new AiAssistant()
    const callbacks = makeCallbacks()
    const turn = assistant.sendMessage("hi", callbacks)
    await new Promise((resolve) => setTimeout(resolve, 0))
    assistant.cancel()
    await turn

    expect(mockDeleteMessage).toHaveBeenCalled()
    expect(callbacks.turnEnds).toBe(1)
  })

  it("ignores empty prompts and turns while busy", async () => {
    const assistant = new AiAssistant()
    const callbacks = makeCallbacks()
    await assistant.sendMessage("   ", callbacks)
    expect(mockAddMessage).not.toHaveBeenCalled()
  })

  it("does nothing when the assistant is disabled in settings", async () => {
    mockGetAiSettings.mockResolvedValue({ ...providerSettings, enabled: false })
    const assistant = new AiAssistant()
    const callbacks = makeCallbacks()
    await assistant.sendMessage("hi", callbacks)
    expect(mockAddMessage).not.toHaveBeenCalled()
  })

  it("clears history and in-memory state", async () => {
    const assistant = new AiAssistant()
    await assistant.clearHistory()
    expect(aiChatDb.clearChatMessages).toHaveBeenCalled()
    expect(assistant.isBusy()).toBe(false)
  })
})

describe("visibleMessages", () => {
  it("filters system and tool rows out of the UI list", () => {
    const all: AiChatMessage[] = [
      { role: "system", content: "sys", created_at: "" },
      { role: "user", content: "u", created_at: "" },
      { role: "assistant", content: "a", created_at: "" },
      { role: "tool", content: "{}", tool_call_id: "c", tool_name: "x", created_at: "" },
    ]
    expect(visibleMessages(all)).toHaveLength(2)
  })
})
