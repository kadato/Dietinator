import type { DiaryEntry, SearchFoodResult } from "@/types"

import * as diaryDb from "@/db/diary"
import * as foodCacheDb from "@/db/food-cache"
import { deleteFoodEntry, logFood, logManualEntry, quickLogFood, updateDiaryEntry } from "../diary"
import { getFoodRemote } from "../yazio/foods"
import { removeEntryFromYazio, syncEntryToYazio } from "../yazio/sync"

jest.mock("@/db/diary", () => ({
  addDiaryEntry: jest.fn(),
  getDiaryEntriesForDate: jest.fn(),
  getDiaryEntryById: jest.fn(),
  removeDiaryEntry: jest.fn(),
  updateDiaryEntryNutrients: jest.fn(),
  updateDiaryEntryDetails: jest.fn(),
  addDeletedYazioItemId: jest.fn(),
  pruneDeletedYazioItems: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/db/food-cache", () => ({
  getFoodsByIds: jest.fn(),
  getFoodById: jest.fn(),
  getCachedFoodById: jest.fn(),
  saveFoodToCache: jest.fn().mockResolvedValue(undefined),
  touchFoodUsed: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/db/settings", () => ({
  getSettings: jest.fn(),
}))

jest.mock("../yazio/foods", () => ({
  getFoodRemote: jest.fn(),
}))

jest.mock("../yazio/sync", () => ({
  syncEntryToYazio: jest.fn().mockResolvedValue(undefined),
  removeEntryFromYazio: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("../agent-bridge", () => ({
  pushSnapshot: jest.fn().mockResolvedValue(undefined),
}))

const mockAddDiaryEntry = diaryDb.addDiaryEntry as jest.MockedFunction<typeof diaryDb.addDiaryEntry>
const mockGetEntryById = diaryDb.getDiaryEntryById as jest.MockedFunction<
  typeof diaryDb.getDiaryEntryById
>
const mockGetFoodById = foodCacheDb.getFoodById as jest.MockedFunction<
  typeof foodCacheDb.getFoodById
>
const mockGetFoodRemote = getFoodRemote as jest.MockedFunction<typeof getFoodRemote>

const entry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: "entry-1",
  date: "2026-08-08",
  meal_type: "lunch",
  food_id: "food-1",
  food_name: "Banana",
  amount: 150,
  unit: "g",
  kcal: 134,
  protein: 1.7,
  carbs: 34.5,
  fat: 0.5,
  created_at: "2026-08-08T12:00:00.000Z",
  yazio_synced: 0,
  yazio_item_id: null,
  ...overrides,
})

const food = (overrides: Partial<SearchFoodResult> = {}): SearchFoodResult => ({
  product_id: "food-1",
  name: "Banana",
  producer: "Chiquita",
  nutrients: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
  serving: { serving: "100 g", amount: 100, serving_quantity: 100 },
  base_unit: "g",
  is_verified: true,
  ...overrides,
})

describe("logFood", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAddDiaryEntry.mockImplementation(async (partial) => entry({ ...(partial as DiaryEntry) }))
  })

  it("scales per-100g nutrients to the logged amount and saves", async () => {
    const created = await logFood({
      date: "2026-08-08",
      mealType: "lunch",
      food: food(),
      amount: 150,
    })
    expect(created.kcal).toBe(134)
    expect(created.amount).toBe(150)
    expect(mockAddDiaryEntry).toHaveBeenCalledTimes(1)
  })

  it("warm-ups the cache and touches last-used best-effort", async () => {
    await logFood({ date: "2026-08-08", mealType: "lunch", food: food(), amount: 100 })
    expect(foodCacheDb.saveFoodToCache).toHaveBeenCalledWith(food())
    expect(foodCacheDb.touchFoodUsed).toHaveBeenCalledWith("food-1", 100)
  })

  it("fires YAZIO sync without blocking the save", async () => {
    ;(syncEntryToYazio as jest.Mock).mockRejectedValue(new Error("offline"))
    await expect(
      logFood({ date: "2026-08-08", mealType: "lunch", food: food(), amount: 100 }),
    ).resolves.toBeDefined()
    expect(syncEntryToYazio).toHaveBeenCalled()
  })
})

describe("logManualEntry", () => {
  it("creates a serving-based entry with no product id", async () => {
    mockAddDiaryEntry.mockImplementation(async (partial) => entry({ ...(partial as DiaryEntry) }))
    const created = await logManualEntry({
      date: "2026-08-08",
      mealType: "snack",
      name: "  Apple pie  ",
      kcal: 320,
      protein: 4,
    })
    expect(created.food_name).toBe("Apple pie")
    expect(created.food_id).toBeNull()
    expect(created.unit).toBe("serving")
    expect(created.kcal).toBe(320)
    expect(created.protein).toBe(4)
    expect(created.carbs).toBe(0)
  })
})

describe("updateDiaryEntry", () => {
  beforeEach(() => jest.clearAllMocks())

  it("returns null for unknown entries", async () => {
    mockGetEntryById.mockResolvedValue(null)
    await expect(
      updateDiaryEntry({ id: "nope", amount: 100, mealType: "lunch" }),
    ).resolves.toBeNull()
  })

  it("rejects non-positive amounts without writing", async () => {
    const current = entry()
    mockGetEntryById.mockResolvedValue(current)
    await expect(updateDiaryEntry({ id: current.id, amount: 0, mealType: "lunch" })).resolves.toBe(
      current,
    )
    expect(diaryDb.updateDiaryEntryDetails).not.toHaveBeenCalled()
  })

  it("scales stored nutrients linearly for manual entries", async () => {
    const current = entry({
      food_id: null,
      unit: "serving",
      amount: 100,
      kcal: 200,
      protein: 10,
      carbs: 20,
      fat: 5,
    })
    mockGetEntryById.mockResolvedValue(current)
    await updateDiaryEntry({ id: current.id, amount: 200, mealType: "dinner" })
    expect(diaryDb.updateDiaryEntryDetails).toHaveBeenCalledWith(current.id, {
      amount: 200,
      unit: "serving",
      meal_type: "dinner",
      food_name: current.food_name,
      nutrients: { kcal: 400, protein: 20, carbs: 40, fat: 10 },
    })
  })

  it("falls back to the cache then the remote when scaling product entries", async () => {
    const current = entry({ amount: 100, kcal: 89 })
    mockGetEntryById.mockResolvedValue(current)
    mockGetFoodById.mockResolvedValue(null)
    mockGetFoodRemote.mockResolvedValue(
      food({ nutrients: { kcal: 100, protein: 1, carbs: 2, fat: 3 } }),
    )
    await updateDiaryEntry({ id: current.id, amount: 100, mealType: "lunch" })
    expect(diaryDb.updateDiaryEntryDetails).toHaveBeenCalled()
  })
})

describe("deleteFoodEntry", () => {
  beforeEach(() => jest.clearAllMocks())

  it("does nothing for unknown entries", async () => {
    mockGetEntryById.mockResolvedValue(null)
    await deleteFoodEntry("nope")
    expect(diaryDb.removeDiaryEntry).not.toHaveBeenCalled()
  })

  it("tombstones synced entries before removal", async () => {
    const current = entry({ yazio_synced: 1, yazio_item_id: "yazio-42" })
    mockGetEntryById.mockResolvedValue(current)
    ;(removeEntryFromYazio as jest.Mock).mockRejectedValue(new Error("offline"))
    await deleteFoodEntry(current.id)
    expect(diaryDb.addDeletedYazioItemId).toHaveBeenCalledWith("yazio-42")
    expect(diaryDb.removeDiaryEntry).toHaveBeenCalledWith(current.id)
  })

  it("skips the remote delete for never-synced entries", async () => {
    const current = entry({ yazio_synced: 0, yazio_item_id: null })
    mockGetEntryById.mockResolvedValue(current)
    await deleteFoodEntry(current.id)
    expect(diaryDb.addDeletedYazioItemId).not.toHaveBeenCalled()
    expect(removeEntryFromYazio).not.toHaveBeenCalled()
  })
})

describe("quickLogFood", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAddDiaryEntry.mockImplementation(async (partial) => entry({ ...(partial as DiaryEntry) }))
  })

  it("uses the passed amount when provided", async () => {
    const result = await quickLogFood({
      date: "2026-08-08",
      mealType: "lunch",
      food: food(),
      amount: 75,
    })
    expect(result.amount).toBe(75)
    expect(result.entry.amount).toBe(75)
  })

  it("uses food.last_amount when amount is omitted", async () => {
    const result = await quickLogFood({
      date: "2026-08-08",
      mealType: "lunch",
      food: food({ last_amount: 50 }),
    })
    expect(result.amount).toBe(50)
    expect(result.entry.amount).toBe(50)
  })

  it("falls back to cached.last_amount when food.last_amount is omitted", async () => {
    ;(foodCacheDb.getCachedFoodById as jest.Mock).mockResolvedValueOnce({
      yazio_product_id: "food-1",
      last_amount: 60,
    })
    const result = await quickLogFood({
      date: "2026-08-08",
      mealType: "lunch",
      food: food({ last_amount: undefined }),
    })
    expect(result.amount).toBe(60)
    expect(result.entry.amount).toBe(60)
  })
})
