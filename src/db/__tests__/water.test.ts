import { getDatabase } from "@/db/database"
import {
  addWaterEntry,
  deleteWaterEntry,
  getWaterEntriesForDate,
  getWaterTotalForDate,
} from "../water"

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

describe("water entries", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("addWaterEntry inserts a pour with a generated id", async () => {
    const db = createMockDb()
    await addWaterEntry({ date: "2026-08-10", amountMl: 330 })

    expect(db.runAsync).toHaveBeenCalledTimes(1)
    const [sql, id, date, amountMl, createdAt] = db.runAsync.mock.calls[0]
    expect(sql).toContain("INSERT INTO water_log")
    expect(typeof id).toBe("string")
    expect(date).toBe("2026-08-10")
    expect(amountMl).toBe(330)
    expect(typeof createdAt).toBe("string")
  })

  it("getWaterEntriesForDate queries a single date in creation order", async () => {
    const db = createMockDb()
    db.getAllAsync.mockResolvedValue([
      { id: "a", date: "2026-08-10", amount_ml: 250, created_at: "x" },
    ])
    const rows = await getWaterEntriesForDate("2026-08-10")

    const [sql, date] = db.getAllAsync.mock.calls[0]
    expect(sql).toContain("WHERE date = ?")
    expect(sql).toContain("ORDER BY created_at ASC")
    expect(date).toBe("2026-08-10")
    expect(rows).toHaveLength(1)
    expect(rows[0]?.amount_ml).toBe(250)
  })

  it("getWaterTotalForDate sums pours and defaults to 0", async () => {
    const db = createMockDb()
    db.getFirstAsync.mockResolvedValueOnce({ total: 1080 })
    const total = await getWaterTotalForDate("2026-08-10")
    expect(db.getFirstAsync.mock.calls[0][0]).toContain("SUM(amount_ml)")
    expect(db.getFirstAsync.mock.calls[0][1]).toBe("2026-08-10")
    expect(total).toBe(1080)

    createMockDb()
    expect(await getWaterTotalForDate("2026-01-01")).toBe(0)
  })

  it("deleteWaterEntry targets the id", async () => {
    const db = createMockDb()
    await deleteWaterEntry("pour-1")
    expect(db.runAsync).toHaveBeenCalledWith("DELETE FROM water_log WHERE id = ?", "pour-1")
  })
})
