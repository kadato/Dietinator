import type { AiChatMessage, AiToolCallInfo } from "@/types"
import { getDatabase } from "./database"

const MAX_PERSISTED_MESSAGES = 200

type AiChatRow = {
  id: number
  role: string
  content: string
  reasoning: string
  tool_calls_json: string | null
  tool_call_id: string | null
  tool_name: string | null
  is_error: number
  created_at: string
}

function rowToMessage(row: AiChatRow): AiChatMessage {
  let toolCalls: AiToolCallInfo[] | undefined
  if (row.tool_calls_json) {
    try {
      toolCalls = JSON.parse(row.tool_calls_json) as AiToolCallInfo[]
    } catch {
      toolCalls = undefined
    }
  }
  return {
    id: Number(row.id),
    role: row.role as AiChatMessage["role"],
    content: row.content,
    reasoning: row.reasoning || undefined,
    tool_calls: toolCalls,
    tool_call_id: row.tool_call_id ?? undefined,
    tool_name: row.tool_name ?? undefined,
    is_error: Number(row.is_error),
    created_at: row.created_at,
  }
}

export async function getChatMessages(): Promise<AiChatMessage[]> {
  const db = await getDatabase()
  const rows = await db.getAllAsync<AiChatRow>("SELECT * FROM ai_chat_messages ORDER BY id ASC")
  return rows.map(rowToMessage)
}

/** Insert a message and trim the table to the last N rows. */
export async function addChatMessage(message: AiChatMessage): Promise<number> {
  const db = await getDatabase()
  const result = await db.runAsync(
    `INSERT INTO ai_chat_messages (
      role, content, reasoning, tool_calls_json, tool_call_id, tool_name, is_error, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    message.role,
    message.content,
    message.reasoning ?? "",
    message.tool_calls ? JSON.stringify(message.tool_calls) : null,
    message.tool_call_id ?? null,
    message.tool_name ?? null,
    message.is_error ?? 0,
    message.created_at,
  )
  const id = Number(result.lastInsertRowId)
  await trimChatMessages()
  return id
}

/** Merge-update a message in place (used while streaming content into it). */
export async function updateChatMessage(
  id: number,
  partial: Partial<Pick<AiChatMessage, "content" | "reasoning" | "tool_calls" | "is_error">>,
): Promise<void> {
  const db = await getDatabase()
  await db.runAsync(
    `UPDATE ai_chat_messages
       SET content = COALESCE(?, content),
           reasoning = COALESCE(?, reasoning),
           tool_calls_json = COALESCE(?, tool_calls_json),
           is_error = COALESCE(?, is_error)
     WHERE id = ?`,
    partial.content ?? null,
    partial.reasoning ?? null,
    partial.tool_calls ? JSON.stringify(partial.tool_calls) : null,
    partial.is_error ?? null,
    id,
  )
}

export async function deleteChatMessage(id: number): Promise<void> {
  const db = await getDatabase()
  await db.runAsync("DELETE FROM ai_chat_messages WHERE id = ?", id)
}

export async function clearChatMessages(): Promise<void> {
  const db = await getDatabase()
  await db.runAsync("DELETE FROM ai_chat_messages")
}

async function trimChatMessages(): Promise<void> {
  const db = await getDatabase()
  await db.runAsync(
    `DELETE FROM ai_chat_messages
      WHERE id NOT IN (
        SELECT id FROM ai_chat_messages ORDER BY id DESC LIMIT ?
      )`,
    MAX_PERSISTED_MESSAGES,
  )
}
