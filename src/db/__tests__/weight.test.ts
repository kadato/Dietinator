import { getDatabase } from "@/db/database"
import {
  deleteWeightEntry,
  getLatestWeightEntry,
  getRecentWeightEntries,
  getWeightEntries,
  getWeightEntryForDate,
  saveWeightEntry,
} from "../weight"

jest.mock("@/db/database", () => ({
  getDatabase: jest.fn(),
}))

function createMockDb() {
  const db = {
    runAsync: jest.fn(async () => ({ lastInsertRowId: 1 })),
    getAllAsync: jest.fn(async (): Promise<unknown[]> => []),
    getFirstAsync: jest.fn(async (): Promise<unknown> => null),
  }
  ;(getDatabase as jest.Mock).mockResolvedValue(db)
  return db as unknown as {
    runAsync: jest.Mock
    getAllAsync: jest.Mock
    getFirstAsync: jest.Mock
  }
}

describe("weight entries", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("saveWeightEntry upserts per date and trims empty notes", async () => {
    const db = createMockDb()
    await saveWeightEntry({ date: "2026-08-10", weightKg: 72.4, note: "  " })

    expect(db.runAsync).toHaveBeenCalledTimes(1)
    const [sql, id, date, weightKg, note, createdAt] = db.runAsync.mock.calls[0]
    expect(sql).toContain("INSERT INTO weight_entries")
    expect(sql).toContain("ON CONFLICT(date) DO UPDATE")
    expect(typeof id).toBe("string")
    expect(date).toBe("2026-08-10")
    expect(weightKg).toBe(72.4)
    expect(note).toBeNull()
    expect(typeof createdAt).toBe("string")
  })

  it("saveWeightEntry keeps a provided note", async () => {
    const db = createMockDb()
    await saveWeightEntry({ date: "2026-08-09", weightKg: 73, note: "morning" })
    expect(db.runAsync.mock.calls[0][4]).toBe("morning")
  })

  it("getWeightEntries filters from a date and orders ascending", async () => {
    const db = createMockDb()
    db.getAllAsync.mockResolvedValue([
      { id: "a", date: "2026-08-01", weight_kg: 74, created_at: "" },
    ])
    const rows = await getWeightEntries("2026-07-01")

    expect(db.getAllAsync.mock.calls[0][0]).toContain("WHERE date >= ?")
    expect(db.getAllAsync.mock.calls[0][0]).toContain("ORDER BY date ASC")
    expect(rows).toHaveLength(1)
  })

  it("getWeightEntries without a filter reads the whole history", async () => {
    const db = createMockDb()
    await getWeightEntries()
    expect(db.getAllAsync.mock.calls[0][0]).not.toContain("WHERE")
  })

  it("getWeightEntryForDate queries a single date", async () => {
    const db = createMockDb()
    db.getFirstAsync.mockResolvedValue({
      id: "a",
      date: "2026-08-10",
      weight_kg: 72,
      note: null,
      created_at: "x",
    })
    const entry = await getWeightEntryForDate("2026-08-10")
    expect(db.getFirstAsync.mock.calls[0][0]).toContain("WHERE date = ?")
    expect(db.getFirstAsync.mock.calls[0][1]).toBe("2026-08-10")
    expect(entry?.weight_kg).toBe(72)
  })

  it("getWeightEntryForDate returns null when nothing is logged", async () => {
    createMockDb()
    expect(await getWeightEntryForDate("2026-01-01")).toBeNull()
  })

  it("getLatestWeightEntry orders by date descending", async () => {
    const db = createMockDb()
    db.getFirstAsync.mockResolvedValue({ id: "b", date: "2026-08-11", weight_kg: 71.5 })
    const entry = await getLatestWeightEntry()
    expect(db.getFirstAsync.mock.calls[0][0]).toContain("ORDER BY date DESC LIMIT 1")
    expect(entry?.date).toBe("2026-08-11")
  })

  it("getRecentWeightEntries returns the latest N ordered by date descending", async () => {
    const db = createMockDb()
    db.getAllAsync.mockResolvedValue([
      { id: "b", date: "2026-08-11", weight_kg: 71.5 },
      { id: "a", date: "2026-08-01", weight_kg: 74 },
    ])
    const rows = await getRecentWeightEntries(2)
    expect(db.getAllAsync.mock.calls[0][0]).toContain("ORDER BY date DESC")
    expect(db.getAllAsync.mock.calls[0][0]).toContain("LIMIT ?")
    expect(db.getAllAsync.mock.calls[0][1]).toEqual([2])
    expect(rows).toHaveLength(2)
    expect(rows[0]?.date).toBe("2026-08-11")
  })

  it("deleteWeightEntry targets the id", async () => {
    const db = createMockDb()
    await deleteWeightEntry("entry-1")
    expect(db.runAsync).toHaveBeenCalledWith("DELETE FROM weight_entries WHERE id = ?", "entry-1")
  })
})
