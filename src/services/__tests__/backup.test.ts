import { isValidBackup, restoreBackup, type BackupPayload } from "../backup"
import { getDatabase } from "@/db/database"

jest.mock("@/db/database", () => ({
  getDatabase: jest.fn(),
}))

const validPayload = (): BackupPayload => ({
  app: "dietinator",
  version: 1,
  exported_at: "2026-08-08T10:00:00.000Z",
  settings: { calorie_goal: 1800 },
  diary_entries: [
    {
      id: "e1",
      date: "2026-08-08",
      meal_type: "lunch",
      food_id: null,
      food_name: "Apple pie",
      amount: 1,
      unit: "serving",
      kcal: 320,
      protein: 4,
      carbs: 50,
      fat: 12,
      created_at: "2026-08-08T11:00:00.000Z",
      yazio_synced: 0,
      yazio_item_id: null,
    },
  ],
  food_cache: [],
  deleted_yazio_items: [],
  meals: [],
  meal_items: [],
})

describe("isValidBackup", () => {
  it("accepts a well-formed backup", () => {
    expect(isValidBackup(validPayload())).toBe(true)
  })

  it("rejects non-objects and missing markers", () => {
    expect(isValidBackup(null)).toBe(false)
    expect(isValidBackup("nope")).toBe(false)
    expect(isValidBackup({ app: "other", version: 1 })).toBe(false)
    expect(isValidBackup({ app: "dietinator", version: 2 })).toBe(false)
  })

  it("rejects backups with missing or non-array tables", () => {
    const partial = validPayload()
    delete (partial as Partial<BackupPayload>).diary_entries
    expect(isValidBackup(partial)).toBe(false)

    const bad = validPayload()
    bad.meals = "nope" as never
    expect(isValidBackup(bad)).toBe(false)
  })
})

describe("restoreBackup", () => {
  const runAsync = jest.fn().mockResolvedValue(undefined)
  const execAsync = jest.fn().mockResolvedValue(undefined)
  const getAllAsync = jest.fn(async () => [{ name: "calorie_goal" }])
  const withTransactionAsync = jest.fn(async (fn: () => Promise<void>) => {
    await fn()
  })
  const db = { runAsync, execAsync, withTransactionAsync, getAllAsync }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getDatabase as jest.Mock).mockResolvedValue(db)
  })

  it("throws on invalid payloads without touching the database", async () => {
    await expect(restoreBackup({ app: "nope" })).rejects.toThrow("not a valid Dietinator backup")
    expect(db.withTransactionAsync).not.toHaveBeenCalled()
  })

  it("clears all tables, restores settings and entries, and reports counts", async () => {
    const result = await restoreBackup(validPayload())
    expect(result).toEqual({
      diaryEntries: 1,
      foodCache: 0,
      meals: 0,
      waterLogs: 0,
      weightEntries: 0,
      chatMessages: 0,
    })

    const clearSql = String(execAsync.mock.calls[0][0])
    for (const table of [
      "meals",
      "meal_items",
      "diary_entries",
      "food_cache",
      "deleted_yazio_items",
      "water_log",
      "weight_entries",
      "ai_chat_messages",
      "settings",
    ]) {
      expect(clearSql).toContain(`DELETE FROM ${table}`)
    }

    const settingsInsert = runAsync.mock.calls.find(([sql]) =>
      (sql as string).includes("INSERT INTO settings"),
    )
    expect(settingsInsert).toBeDefined()
    expect(settingsInsert[1]).toBe(1800)

    const entryInsert = runAsync.mock.calls.find(([sql]) =>
      (sql as string).includes("INSERT OR REPLACE INTO diary_entries"),
    )
    expect(entryInsert).toBeDefined()
    expect(entryInsert).toContain("e1")
  })

  it("re-inserts a default settings row when the backup has none", async () => {
    const payload = validPayload()
    payload.settings = null
    await restoreBackup(payload)
    const settingsInsert = runAsync.mock.calls.find(([sql]) =>
      (sql as string).includes("INSERT INTO settings (id)"),
    )
    expect(settingsInsert).toBeDefined()
  })

  it("rejects rows with missing ids before touching the database", async () => {
    const payload = validPayload()
    payload.diary_entries = [{ date: "2026-08-08" }]
    await expect(restoreBackup(payload)).rejects.toThrow("id and date")
    expect(db.withTransactionAsync).not.toHaveBeenCalled()
  })

  it("restores chat messages when present", async () => {
    const payload = validPayload()
    payload.ai_chat_messages = [
      { id: 1, role: "user", content: "hi", created_at: "2026-08-08T10:00:00.000Z" },
    ]
    const result = await restoreBackup(payload)
    expect(result.chatMessages).toBe(1)
    const chatInsert = runAsync.mock.calls.find(([sql]) =>
      (sql as string).includes("INSERT OR REPLACE INTO ai_chat_messages"),
    )
    expect(chatInsert).toBeDefined()
  })
})
