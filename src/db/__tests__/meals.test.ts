import { deleteMeal, getMealById, getMeals, saveMeal, touchMealUsed } from "../meals"
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

const mealRow = (overrides = {}) => ({
  id: "m1",
  name: "Breakfast",
  created_at: "2026-08-08T10:00:00.000Z",
  updated_at: "2026-08-08T10:00:00.000Z",
  last_used_at: null,
  ...overrides,
})

const itemRow = (overrides = {}) => ({
  meal_id: "m1",
  position: 0,
  product_id: "p1",
  name: "Banana",
  producer: "Dole",
  amount: 100,
  base_unit: "g",
  nutrients_json: JSON.stringify({ kcal: 89, protein: 1, carbs: 23, fat: 0 }),
  serving_json: JSON.stringify({ serving: "100 g", amount: 100, serving_quantity: 100 }),
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe("meals db", () => {
  it("groups items by meal and drops invalid rows", async () => {
    mockDb({
      getAllAsync: jest
        .fn()
        .mockResolvedValueOnce([mealRow(), mealRow({ id: "m2", name: "Lunch" })])
        .mockResolvedValueOnce([itemRow(), itemRow({ nutrients_json: "bad" })]),
    })
    const meals = await getMeals()
    expect(meals).toHaveLength(2)
    expect(meals[0].items).toHaveLength(1)
    expect(meals[1].items).toHaveLength(0)
  })

  it("returns null for unknown meals", async () => {
    mockDb({ getFirstAsync: jest.fn().mockResolvedValue(null) })
    await expect(getMealById("missing")).resolves.toBeNull()
  })

  it("loads a meal with its items", async () => {
    mockDb({
      getFirstAsync: jest.fn().mockResolvedValue(mealRow()),
      getAllAsync: jest.fn().mockResolvedValue([itemRow()]),
    })
    const meal = await getMealById("m1")
    expect(meal?.items).toHaveLength(1)
  })

  it("inserts a new meal and its items", async () => {
    const db = mockDb({ getFirstAsync: jest.fn().mockResolvedValue(null) })
    await saveMeal({
      id: "m1",
      name: "  Breakfast ",
      created_at: "2026-08-08T10:00:00.000Z",
      updated_at: "2026-08-08T11:00:00.000Z",
      items: [
        {
          product_id: "p1",
          name: "Banana",
          producer: "",
          amount: 100,
          base_unit: "g",
          nutrients: { kcal: 89, protein: 1, carbs: 23, fat: 0 },
          serving: { serving: "100 g", amount: 100, serving_quantity: 100 },
        },
      ],
    })
    expect(db.withTransactionAsync).toHaveBeenCalled()
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO meals"),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )
  })

  it("updates an existing meal", async () => {
    const db = mockDb({ getFirstAsync: jest.fn().mockResolvedValue({ id: "m1" }) })
    await saveMeal({
      id: "m1",
      name: "Renamed",
      created_at: "2026-08-08T10:00:00.000Z",
      updated_at: "2026-08-08T11:00:00.000Z",
      items: [],
    })
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE meals"),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )
  })

  it("deletes and touches meals", async () => {
    const db = mockDb()
    await deleteMeal("m1")
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM meal_items"),
      "m1",
    )
    await touchMealUsed("m1")
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("last_used_at"),
      expect.any(String),
      expect.any(String),
      "m1",
    )
  })
})
