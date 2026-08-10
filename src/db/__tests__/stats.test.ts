import { getDatabase } from "@/db/database"
import { getCalorieHistory } from "../stats"

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
