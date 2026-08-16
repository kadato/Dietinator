import type { SQLiteDatabase } from "expo-sqlite"
import {
  cachedToSearchResult,
  getFavoriteFoods,
  getRecentFoodUsages,
  saveFoodToCache,
  saveSearchResultToCache,
  toggleFavorite,
  touchFoodUsed,
  updateFavoriteOrder,
} from "../food-cache"
import { getDatabase } from "@/db/database"
import type { CachedFood, SearchFoodResult } from "@/types"

jest.mock("@/db/database", () => ({
  getDatabase: jest.fn(),
}))

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>

const db = {
  runAsync: jest.fn().mockResolvedValue(undefined),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  withTransactionAsync: jest.fn().mockImplementation(async (cb: () => Promise<unknown>) => cb()),
}

beforeEach(() => {
  db.runAsync.mockClear()
  db.getAllAsync.mockClear()
  db.getFirstAsync.mockClear()
  mockGetDatabase.mockResolvedValue(db as unknown as SQLiteDatabase)
})

const food = (overrides: Partial<SearchFoodResult> = {}): SearchFoodResult => ({
  product_id: "prod-1",
  name: "Banana",
  producer: "Dole",
  nutrients: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
  serving: { serving: "whole.regular", amount: 150, serving_quantity: 100 },
  servings: [
    { serving: "whole.regular", amount: 150, serving_quantity: 100 },
    { serving: "cup", amount: 240, serving_quantity: 100 },
    { serving: "each", amount: 60, serving_quantity: 100 },
  ],
  base_unit: "g",
  is_verified: true,
  ...overrides,
})

describe("cachedToSearchResult", () => {
  const cached = (overrides: Partial<CachedFood> = {}): CachedFood => ({
    yazio_product_id: "prod-1",
    barcode: null,
    name: "Banana",
    producer: "Dole",
    nutrients_json: JSON.stringify(food().nutrients),
    serving_json: JSON.stringify(food().serving),
    servings_json: JSON.stringify(food().servings),
    base_unit: "g",
    cached_at: "2026-08-10T00:00:00.000Z",
    is_favorite: 0,
    last_used_at: null,
    last_amount: null,
    source: "detail",
    ...overrides,
  })

  it("restores the named serving options (cup, each, whole)", () => {
    const result = cachedToSearchResult(cached())
    expect(result?.servings).toEqual(food().servings)
    expect(result?.serving).toEqual(food().serving)
  })

  it("omits servings for rows without a servings column value", () => {
    const result = cachedToSearchResult(cached({ servings_json: null }))
    expect(result?.servings).toBeUndefined()
  })

  it("returns null for malformed rows", () => {
    expect(cachedToSearchResult(cached({ nutrients_json: "not-json" }))).toBeNull()
  })
})

describe("saveFoodToCache", () => {
  it("persists the named serving options as JSON", async () => {
    await saveFoodToCache(food(), null, true, "detail")
    const sql = db.runAsync.mock.calls[0][0] as string
    const args = db.runAsync.mock.calls[0].slice(1) as unknown[]
    expect(sql).toContain("servings_json")
    expect(args).toContain(JSON.stringify(food().servings))
  })

  it("stores null servings for foods without options", async () => {
    await saveFoodToCache(food({ servings: undefined }))
    const args = db.runAsync.mock.calls[0].slice(1) as unknown[]
    expect(args).toContain(null)
  })
})

describe("saveSearchResultToCache", () => {
  it("never stores serving options on search rows", async () => {
    await saveSearchResultToCache(food())
    const sql = db.runAsync.mock.calls[0][0] as string
    const args = db.runAsync.mock.calls[0].slice(1) as unknown[]
    expect(sql).toContain("servings_json")
    expect(args).toContain(null)
  })
})

describe("touchFoodUsed", () => {
  it("remembers the last logged amount", async () => {
    await touchFoodUsed("prod-1", 250)
    const sql = db.runAsync.mock.calls[0][0] as string
    const args = db.runAsync.mock.calls[0].slice(1) as unknown[]
    expect(sql).toContain("last_amount = COALESCE(?, last_amount)")
    expect(args).toContain(250)
    expect(args[0]).toEqual(expect.any(String))
  })

  it("keeps the stored amount when none is given", async () => {
    await touchFoodUsed("prod-1")
    const args = db.runAsync.mock.calls[0].slice(1) as unknown[]
    expect(args[1]).toBeNull()
  })
})

describe("getRecentFoodUsages", () => {
  const cacheRow = {
    yazio_product_id: "prod-1",
    barcode: null,
    name: "Banana",
    producer: "Dole",
    nutrients_json: JSON.stringify(food().nutrients),
    serving_json: JSON.stringify(food().serving),
    servings_json: JSON.stringify(food().servings),
    base_unit: "g",
    cached_at: "2026-08-10T00:00:00.000Z",
    is_favorite: 0,
    last_used_at: null,
    last_amount: 120,
    source: "detail",
  }

  it("groups diary logs by food and amount, newest first", async () => {
    db.getAllAsync
      .mockResolvedValueOnce([
        { food_id: "prod-1", amount: 120, last_logged: "2026-08-11T08:00:00.000Z" },
        { food_id: "prod-1", amount: 90, last_logged: "2026-08-09T08:00:00.000Z" },
      ])
      .mockResolvedValueOnce([cacheRow])
    const usages = await getRecentFoodUsages(10)
    expect(usages).toHaveLength(2)
    expect(usages[0].amount).toBe(120)
    expect(usages[1].amount).toBe(90)
    expect(usages[0].food.name).toBe("Banana")
    const sql = db.getAllAsync.mock.calls[0][0] as string
    expect(sql).toContain("GROUP BY d.food_id, d.amount")
    expect(sql).toContain("ORDER BY last_logged DESC")
    expect(db.getAllAsync.mock.calls[0][1]).toBe(10)
  })

  it("skips usage rows whose food is no longer cached", async () => {
    db.getAllAsync
      .mockResolvedValueOnce([
        { food_id: "prod-ghost", amount: 50, last_logged: "2026-08-11T08:00:00.000Z" },
      ])
      .mockResolvedValueOnce([])
    const usages = await getRecentFoodUsages()
    expect(usages).toHaveLength(0)
  })

  it("returns an empty list when there are no logs", async () => {
    db.getAllAsync.mockClear()
    db.getAllAsync.mockResolvedValueOnce([])
    const usages = await getRecentFoodUsages()
    expect(usages).toHaveLength(0)
    expect(db.getAllAsync).toHaveBeenCalledTimes(1)
  })
})

describe("favorites and reordering", () => {
  it("getFavoriteFoods queries ordered by favorite_order ASC, name ASC", async () => {
    db.getAllAsync.mockResolvedValueOnce([])
    await getFavoriteFoods()
    const sql = db.getAllAsync.mock.calls[0][0] as string
    expect(sql).toContain("ORDER BY favorite_order ASC, name ASC")
  })

  it("toggleFavorite appends with next favorite_order when favoriting", async () => {
    db.getFirstAsync
      .mockResolvedValueOnce(null) // is_favorite query -> 0
      .mockResolvedValueOnce({ max_order: 3 }) // max order query -> 3
    const result = await toggleFavorite("prod-1", food())
    expect(result).toBe(true)
    const updateCall = db.runAsync.mock.calls.find((call) =>
      String(call[0]).includes("UPDATE food_cache SET is_favorite = 1"),
    )
    expect(updateCall).toBeDefined()
    expect(updateCall?.[1]).toBe(4) // 3 + 1 = 4
    expect(updateCall?.[2]).toBe("prod-1")
  })

  it("updateFavoriteOrder persists new indices for all items", async () => {
    db.runAsync.mockClear()
    await updateFavoriteOrder(["prod-b", "prod-a", "prod-c"])
    expect(db.runAsync).toHaveBeenCalledTimes(3)
    expect(db.runAsync).toHaveBeenNthCalledWith(
      1,
      "UPDATE food_cache SET favorite_order = ? WHERE yazio_product_id = ?",
      0,
      "prod-b",
    )
    expect(db.runAsync).toHaveBeenNthCalledWith(
      2,
      "UPDATE food_cache SET favorite_order = ? WHERE yazio_product_id = ?",
      1,
      "prod-a",
    )
    expect(db.runAsync).toHaveBeenNthCalledWith(
      3,
      "UPDATE food_cache SET favorite_order = ? WHERE yazio_product_id = ?",
      2,
      "prod-c",
    )
  })
})
