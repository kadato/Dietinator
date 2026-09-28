import { bulkAddDiaryEntries, updateDiaryEntryDetails } from "../diary"
import { getDatabase } from "../database"

jest.mock("../database", () => ({
  getDatabase: jest.fn(),
}))

describe("updateDiaryEntryDetails", () => {
  const runAsync = jest.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getDatabase as jest.Mock).mockResolvedValue({ runAsync })
  })

  it("updates only the given amount when no other fields change", async () => {
    await updateDiaryEntryDetails("e1", { amount: 150 })
    expect(runAsync).toHaveBeenCalledWith(
      "UPDATE diary_entries SET amount = ? WHERE id = ?",
      150,
      "e1",
    )
  })

  it("keeps unspecified columns instead of overwriting with defaults", async () => {
    await updateDiaryEntryDetails("e1", { amount: 200, meal_type: "dinner" })
    const [sql] = runAsync.mock.calls[0]
    expect(sql).toContain("amount = ?")
    expect(sql).toContain("meal_type = ?")
    expect(sql).not.toContain("food_name")
    expect(sql).not.toContain("kcal")
  })
})

describe("bulkAddDiaryEntries", () => {
  it("inserts every copy in one transaction", async () => {
    const runAsync = jest.fn().mockResolvedValue(undefined)
    const withTransactionAsync = jest.fn(async (fn: () => Promise<void>) => fn())
    ;(getDatabase as jest.Mock).mockResolvedValue({ runAsync, withTransactionAsync })
    const rows = [
      {
        id: "c1",
        date: "2026-08-09",
        meal_type: "lunch",
        food_id: "p1",
        food_name: "Banana",
        amount: 100,
        unit: "g",
        kcal: 89,
        protein: 1,
        carbs: 23,
        fat: 0,
        created_at: "2026-08-09T10:00:00.000Z",
      },
      {
        id: "c2",
        date: "2026-08-09",
        meal_type: "snack",
        food_id: null,
        food_name: "Pie",
        amount: 1,
        unit: "serving",
        kcal: 300,
        protein: 4,
        carbs: 40,
        fat: 12,
        created_at: "2026-08-09T11:00:00.000Z",
      },
    ]
    const created = await bulkAddDiaryEntries(rows as never)
    expect(withTransactionAsync).toHaveBeenCalledTimes(1)
    expect(runAsync).toHaveBeenCalledTimes(2)
    expect(created).toHaveLength(2)
  })
})
