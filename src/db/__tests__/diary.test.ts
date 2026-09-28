import {
  addDeletedYazioItemId,
  addDiaryEntry,
  exportDiaryCsv,
  exportDiaryJson,
  getDeletedYazioItemIds,
  getDiaryEntriesForDate,
  getDiaryEntryById,
  getDiaryEntryCount,
  getUnsyncedEntries,
  getYazioItemIdsForDate,
  isDeletedYazioItemId,
  markDiaryEntrySynced,
  markDiaryEntryUnsynced,
  pruneDeletedYazioItems,
  removeDeletedYazioItemId,
  removeDiaryEntry,
  reserveYazioItemId,
  updateDiaryEntryDetails,
  updateDiaryEntryNutrients,
} from "../diary"
import { getDatabase } from "../database"

jest.mock("../database", () => ({
  getDatabase: jest.fn(),
}))

const mockGetDatabase = getDatabase as jest.Mock

function mockDb(overrides = {}) {
  const db = {
    runAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
    ...overrides,
  }
  mockGetDatabase.mockResolvedValue(db)
  return db
}

const row = (overrides = {}) => ({
  id: "e1",
  date: "2026-08-08",
  meal_type: "lunch",
  food_id: "p1",
  food_name: "Banana",
  amount: 100,
  unit: "g",
  kcal: 89,
  protein: 1,
  carbs: 23,
  fat: 0,
  created_at: "2026-08-08T10:00:00.000Z",
  yazio_synced: 0,
  yazio_item_id: null,
  ...overrides,
})

const entryInput = (overrides = {}) => ({
  id: "e1",
  date: "2026-08-08",
  meal_type: "lunch" as const,
  food_id: "p1",
  food_name: "Banana",
  amount: 100,
  unit: "g",
  kcal: 89,
  protein: 1,
  carbs: 23,
  fat: 0,
  created_at: "2026-08-08T10:00:00.000Z",
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe("diary db reads", () => {
  it("maps rows for a date", async () => {
    const db = mockDb({ getAllAsync: jest.fn().mockResolvedValue([row()]) })
    const entries = await getDiaryEntriesForDate("2026-08-08")
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe("e1")
    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining("WHERE date"), "2026-08-08")
  })

  it("counts entries and defaults to zero", async () => {
    mockDb({ getFirstAsync: jest.fn().mockResolvedValue({ count: 3 }) })
    await expect(getDiaryEntryCount()).resolves.toBe(3)
    mockDb({ getFirstAsync: jest.fn().mockResolvedValue(null) })
    await expect(getDiaryEntryCount()).resolves.toBe(0)
  })

  it("fetches by id or returns null", async () => {
    mockDb({ getFirstAsync: jest.fn().mockResolvedValue(row()) })
    await expect(getDiaryEntryById("e1")).resolves.toMatchObject({ id: "e1" })
    mockDb({ getFirstAsync: jest.fn().mockResolvedValue(null) })
    await expect(getDiaryEntryById("missing")).resolves.toBeNull()
  })

  it("lists yazio ids and unsynced rows", async () => {
    const db = mockDb({
      getAllAsync: jest.fn().mockResolvedValue([{ yazio_item_id: "y1" }, { yazio_item_id: null }]),
    })
    const ids = await getYazioItemIdsForDate("2026-08-08")
    expect(ids.has("y1")).toBe(true)
    expect(db.getAllAsync).toHaveBeenCalled()
    mockDb({ getAllAsync: jest.fn().mockResolvedValue([row()]) })
    await expect(getUnsyncedEntries(5)).resolves.toHaveLength(1)
  })
})

describe("diary db writes", () => {
  it("inserts with default sync fields", async () => {
    const db = mockDb()
    const created = await addDiaryEntry(entryInput())
    expect(created.yazio_synced).toBe(0)
    expect(created.yazio_item_id).toBeNull()
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO"),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      0,
      null,
    )
  })

  it("removes and updates nutrients", async () => {
    const db = mockDb()
    await removeDiaryEntry("e1")
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM"), "e1")
    await updateDiaryEntryNutrients("e1", { kcal: 10, protein: 1, carbs: 2, fat: 3 })
    expect(db.runAsync).toHaveBeenLastCalledWith(expect.stringContaining("kcal"), 10, 1, 2, 3, "e1")
  })

  it("updates every optional detail field", async () => {
    const db = mockDb()
    await updateDiaryEntryDetails("e1", {
      amount: 200,
      unit: "ml",
      meal_type: "dinner",
      food_name: "Soup",
      nutrients: { kcal: 50, protein: 2, carbs: 5, fat: 1 },
    })
    const [sql] = db.runAsync.mock.calls[0]
    expect(sql).toContain("unit = ?")
    expect(sql).toContain("meal_type = ?")
    expect(sql).toContain("food_name = ?")
    expect(sql).toContain("kcal = ?")
  })

  it("marks sync state and reserves ids", async () => {
    const db = mockDb()
    await markDiaryEntryUnsynced("e1")
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining("yazio_synced = 0"), "e1")
    await reserveYazioItemId("e1", "y1")
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining("yazio_item_id"), "y1", "e1")
    await markDiaryEntrySynced("e1", "y1")
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("yazio_synced = 1"),
      "y1",
      "e1",
    )
  })
})

describe("deleted yazio ids", () => {
  it("lists, checks, adds, removes and prunes", async () => {
    mockDb({ getAllAsync: jest.fn().mockResolvedValue([{ id: "y1" }, { id: "y2" }]) })
    const ids = await getDeletedYazioItemIds()
    expect(ids.has("y1")).toBe(true)

    mockDb({ getFirstAsync: jest.fn().mockResolvedValue({ id: "y1" }) })
    await expect(isDeletedYazioItemId("y1")).resolves.toBe(true)
    mockDb({ getFirstAsync: jest.fn().mockResolvedValue(null) })
    await expect(isDeletedYazioItemId("missing")).resolves.toBe(false)

    const db = mockDb()
    await addDeletedYazioItemId("y1")
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("deleted_yazio_items"),
      "y1",
      expect.any(String),
    )
    await removeDeletedYazioItemId("y1")
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM deleted_yazio_items"),
      "y1",
    )
    await pruneDeletedYazioItems(7)
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("deleted_at < ?"),
      expect.any(String),
    )
  })
})

describe("diary export", () => {
  it("exports json rows", async () => {
    mockDb({ getAllAsync: jest.fn().mockResolvedValue([row()]) })
    const json = await exportDiaryJson()
    expect(json).toContain("e1")
  })

  it("quotes csv cells and neutralizes formulas", async () => {
    mockDb({
      getAllAsync: jest.fn().mockResolvedValue([
        {
          ...row(),
          food_name: "=cmd",
          meal_type: "lunch",
          date: "2026-08-08",
          amount: 1,
          unit: "g",
          kcal: 1,
          protein: 1,
          carbs: 1,
          fat: 1,
        },
        {
          ...row(),
          id: "e2",
          food_name: 'a"b\nc',
          meal_type: "snack",
          date: "2026-08-08",
          amount: 2,
          unit: "g",
          kcal: 2,
          protein: 2,
          carbs: 2,
          fat: 2,
        },
      ]),
    })
    const csv = await exportDiaryCsv()
    expect(csv.split("\n")[0]).toBe("date,meal_type,food_name,amount,unit,kcal,protein,carbs,fat")
    expect(csv).toContain("'=cmd")
    expect(csv).toContain('a""b c')
  })
})
