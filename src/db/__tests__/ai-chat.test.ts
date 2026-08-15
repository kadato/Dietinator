import { getDatabase } from "@/db/database"
import {
  addChatMessage,
  clearChatMessages,
  deleteChatMessage,
  getChatMessages,
  updateChatMessage,
} from "../ai-chat"
import type { AiChatMessage } from "@/types"

jest.mock("@/db/database", () => ({
  getDatabase: jest.fn(),
}))

function createMockDb() {
  const db = {
    runAsync: jest.fn(async () => ({ lastInsertRowId: 42 })),
    getAllAsync: jest.fn(async (): Promise<unknown[]> => []),
  }
  ;(getDatabase as jest.Mock).mockResolvedValue(db)
  return db as unknown as {
    runAsync: jest.Mock
    getAllAsync: jest.Mock
  }
}

describe("ai-chat history", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("addChatMessage serializes tool calls and trims to the newest rows", async () => {
    const db = createMockDb()
    const message: AiChatMessage = {
      role: "assistant",
      content: "Here you go",
      tool_calls: [{ id: "call-1", name: "get_diary_summary", arguments_json: "{}" }],
      created_at: "2026-08-08T12:00:00.000Z",
    }
    const id = await addChatMessage(message)

    expect(id).toBe(42)
    expect(db.runAsync).toHaveBeenCalledTimes(2)
    expect(db.runAsync.mock.calls[0][0]).toContain("INSERT INTO ai_chat_messages")
    // Params: role, content, reasoning, tool_calls_json, tool_call_id, tool_name, is_error, created_at
    expect(db.runAsync.mock.calls[0][4]).toBe(JSON.stringify(message.tool_calls))
    expect(db.runAsync.mock.calls[1][0]).toContain("DELETE FROM ai_chat_messages")
  })

  it("updateChatMessage updates specified fields dynamically", async () => {
    const db = createMockDb()
    await updateChatMessage(7, { content: "streamed text" })
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE ai_chat_messages SET content = ? WHERE id = ?"),
      "streamed text",
      7,
    )
  })

  it("getChatMessages parses rows back into messages", async () => {
    const db = createMockDb()
    db.getAllAsync.mockResolvedValue([
      {
        id: 1,
        role: "assistant",
        content: "Hi",
        reasoning: "hmm",
        tool_calls_json: JSON.stringify([{ id: "c1", name: "log_food", arguments_json: "{}" }]),
        tool_call_id: null,
        tool_name: null,
        is_error: 0,
        created_at: "2026-08-08T12:00:00.000Z",
      },
    ])
    const messages = await getChatMessages()
    expect(messages[0]).toMatchObject({
      id: 1,
      role: "assistant",
      content: "Hi",
      reasoning: "hmm",
      tool_calls: [{ id: "c1", name: "log_food", arguments_json: "{}" }],
    })
  })

  it("tolerates broken tool_calls JSON", async () => {
    const db = createMockDb()
    db.getAllAsync.mockResolvedValue([
      {
        id: 1,
        role: "user",
        content: "hi",
        reasoning: "",
        tool_calls_json: "{not json",
        tool_call_id: null,
        tool_name: null,
        is_error: 0,
        created_at: "2026-08-08T12:00:00.000Z",
      },
    ])
    const messages = await getChatMessages()
    expect(messages[0].tool_calls).toBeUndefined()
    expect(messages[0].content).toBe("hi")
  })

  it("deleteChatMessage and clearChatMessages run the right statements", async () => {
    const db = createMockDb()
    await deleteChatMessage(5)
    expect(db.runAsync).toHaveBeenCalledWith("DELETE FROM ai_chat_messages WHERE id = ?", 5)
    await clearChatMessages()
    expect(db.runAsync).toHaveBeenCalledWith("DELETE FROM ai_chat_messages")
  })
})
