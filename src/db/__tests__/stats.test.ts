import { getDatabase } from "@/db/database"
import {
  getCalorieHistory,
  getDailyNutritionHistory,
  getMacroHistory,
  getWaterHistory,
} from "../stats"

jest.mock("@/db/database", () => ({
  getDatabase: jest.fn(),
}))

function createMockDb() {
  const db = {
    getAllAsync: jest.fn(async (): Promise<unknown[]> => []),
  }
  ;(getDatabase as jest.Mock).mockResolvedValue(db)
  return db as unknown as { getAllAsync: jest.Mock }
}

describe("getDailyNutritionHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("groups kcal and macros per day from the given date", async () => {
    const db = createMockDb()
    db.getAllAsync.mockResolvedValue([
      { date: "2026-08-09", kcal: 1800, protein: 120, carbs: 180, fat: 60 },
      { date: "2026-08-10", kcal: 2100, protein: 90, carbs: 220, fat: 70 },
    ])
    const history = await getDailyNutritionHistory("2026-08-09")

    const [sql, params] = db.getAllAsync.mock.calls[0]
    expect(sql).toContain("SUM(kcal)")
    expect(sql).toContain("SUM(protein)")
    expect(sql).toContain("GROUP BY date")
    expect(sql).toContain("WHERE date >= ?")
    expect(params).toEqual(["2026-08-09"])
    expect(history[1]).toMatchObject({ date: "2026-08-10", kcal: 2100, protein: 90 })
  })
})

describe("getCalorieHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("groups diary kcal per day from the given date", async () => {
    const db = createMockDb()
    db.getAllAsync.mockResolvedValue([
      { date: "2026-08-09", kcal: 1800 },
      { date: "2026-08-10", kcal: 2100 },
    ])
    const history = await getCalorieHistory("2026-08-09")

    const [sql, params] = db.getAllAsync.mock.calls[0]
    expect(sql).toContain("SUM(kcal)")
    expect(sql).toContain("GROUP BY date")
    expect(sql).toContain("WHERE date >= ?")
    expect(sql).toContain("ORDER BY date ASC")
    expect(params).toEqual(["2026-08-09"])
    expect(history[1]).toMatchObject({ date: "2026-08-10", kcal: 2100 })
  })

  it("returns an empty list when nothing was eaten", async () => {
    createMockDb()
    const history = await getCalorieHistory("2026-08-01")
    expect(history).toEqual([])
  })
})

describe("getMacroHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("sums each macro per day from the given date", async () => {
    const db = createMockDb()
    db.getAllAsync.mockResolvedValue([
      { date: "2026-08-09", protein: 120, carbs: 180, fat: 60 },
      { date: "2026-08-10", protein: 90, carbs: 220, fat: 70 },
    ])
    const history = await getMacroHistory("2026-08-09")

    const [sql, params] = db.getAllAsync.mock.calls[0]
    expect(sql).toContain("SUM(protein)")
    expect(sql).toContain("SUM(carbs)")
    expect(sql).toContain("SUM(fat)")
    expect(sql).toContain("GROUP BY date")
    expect(sql).toContain("WHERE date >= ?")
    expect(params).toEqual(["2026-08-09"])
    expect(history[1]).toMatchObject({ date: "2026-08-10", protein: 90, carbs: 220, fat: 70 })
  })

  it("returns an empty list when nothing was eaten", async () => {
    createMockDb()
    expect(await getMacroHistory("2026-08-01")).toEqual([])
  })
})

describe("getWaterHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("sums water per day from the given date", async () => {
    const db = createMockDb()
    db.getAllAsync.mockResolvedValue([
      { date: "2026-08-09", ml: 1500 },
      { date: "2026-08-10", ml: 2250 },
    ])
    const history = await getWaterHistory("2026-08-09")

    const [sql, params] = db.getAllAsync.mock.calls[0]
    expect(sql).toContain("SUM(amount_ml)")
    expect(sql).toContain("FROM water_log")
    expect(sql).toContain("GROUP BY date")
    expect(sql).toContain("WHERE date >= ?")
    expect(sql).toContain("ORDER BY date ASC")
    expect(params).toEqual(["2026-08-09"])
    expect(history[1]).toMatchObject({ date: "2026-08-10", ml: 2250 })
  })

  it("returns an empty list when nothing was logged", async () => {
    createMockDb()
    expect(await getWaterHistory("2026-08-01")).toEqual([])
  })
})
