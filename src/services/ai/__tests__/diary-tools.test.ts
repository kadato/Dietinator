import * as diaryDb from "@/db/diary"
import * as settingsDb from "@/db/settings"
import * as foodCacheDb from "@/db/food-cache"
import { searchFoodsRemote } from "@/services/yazio/foods"
import { updateDiaryEntry as updateDiaryEntryService } from "@/services/diary"
import { listMeals, logMealToDiary, mealTotals } from "@/services/meals"
import { createDiaryTools, summarizeEntries } from "../diary-tools"
import type { DiaryEntry, Meal, SearchFoodResult } from "@/types"

jest.mock("@/db/diary", () => ({
  getDiaryEntriesForDate: jest.fn(),
  getDiaryEntryCount: jest.fn(),
  getDiaryEntryById: jest.fn(),
  addDiaryEntry: jest.fn(),
  removeDiaryEntry: jest.fn(),
}))

jest.mock("@/db/settings", () => ({
  getSettings: jest.fn(),
  updateSettings: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/db/food-cache", () => ({
  searchLocalFoods: jest.fn(),
}))

jest.mock("@/services/yazio/foods", () => ({
  searchFoodsRemote: jest.fn(),
}))

jest.mock("@/services/diary", () => ({
  updateDiaryEntry: jest.fn(),
}))

jest.mock("@/services/meals", () => ({
  listMeals: jest.fn(),
  mealTotals: jest.fn(),
  logMealToDiary: jest.fn(),
}))

const mockGetEntries = diaryDb.getDiaryEntriesForDate as jest.MockedFunction<
  typeof diaryDb.getDiaryEntriesForDate
>
const mockGetCount = diaryDb.getDiaryEntryCount as jest.MockedFunction<
  typeof diaryDb.getDiaryEntryCount
>
const mockGetEntry = diaryDb.getDiaryEntryById as jest.MockedFunction<
  typeof diaryDb.getDiaryEntryById
>
const mockAddEntry = diaryDb.addDiaryEntry as jest.MockedFunction<typeof diaryDb.addDiaryEntry>
const mockRemoveEntry = diaryDb.removeDiaryEntry as jest.MockedFunction<
  typeof diaryDb.removeDiaryEntry
>
const mockGetSettings = settingsDb.getSettings as jest.MockedFunction<typeof settingsDb.getSettings>
const mockUpdateSettings = settingsDb.updateSettings as jest.MockedFunction<
  typeof settingsDb.updateSettings
>
const mockSearchLocal = foodCacheDb.searchLocalFoods as jest.MockedFunction<
  typeof foodCacheDb.searchLocalFoods
>
const mockSearchRemote = searchFoodsRemote as jest.MockedFunction<typeof searchFoodsRemote>
const mockUpdateEntry = updateDiaryEntryService as jest.MockedFunction<
  typeof updateDiaryEntryService
>
const mockListMeals = listMeals as jest.MockedFunction<typeof listMeals>
const mockLogMeal = logMealToDiary as jest.MockedFunction<typeof logMealToDiary>

const meal = (overrides: Partial<Meal> = {}): Meal => ({
  id: "meal-1",
  name: "Cornflakes with milk",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  last_used_at: null,
  items: [
    {
      product_id: "p-corn",
      name: "Cornflakes",
      producer: "",
      amount: 40,
      base_unit: "g",
      nutrients: { kcal: 150, protein: 3, carbs: 33, fat: 0.5 },
      serving: { serving: "100 g", amount: 100, serving_quantity: 100 },
    },
  ],
  ...overrides,
})

const entry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: "e1",
  date: "2026-08-08",
  meal_type: "lunch",
  food_id: null,
  food_name: "Rice",
  amount: 1,
  unit: "serving",
  kcal: 200,
  protein: 4,
  carbs: 45,
  fat: 0.5,
  created_at: "2026-08-08T12:00:00.000Z",
  yazio_synced: 0,
  yazio_item_id: null,
  ...overrides,
})

const food = (overrides: Partial<SearchFoodResult> = {}): SearchFoodResult => ({
  product_id: "p1",
  name: "Chicken breast",
  producer: "",
  nutrients: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  serving: { serving: "100 g", amount: 100, serving_quantity: 100 },
  base_unit: "g",
  is_verified: true,
  ...overrides,
})

const tools = createDiaryTools()
const byName = (name: string) => tools.find((t) => t.name === name)!

describe("summarizeEntries", () => {
  it("rounds totals and rows", () => {
    const { totals, entries } = summarizeEntries([entry({ kcal: 200.6, protein: 4.44 })])
    expect(totals).toEqual({ kcal: 201, protein: 4.4, carbs: 45, fat: 0.5 })
    expect(entries[0]).toMatchObject({ id: "e1", food_name: "Rice" })
  })
})

describe("get_diary_summary", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns entries, totals and goals for a date", async () => {
    mockGetEntries.mockResolvedValue([entry()])
    mockGetCount.mockResolvedValue(3)
    mockGetSettings.mockResolvedValue({
      calorie_goal: 2000,
      protein_goal: 150,
      carbs_goal: 200,
      fat_goal: 65,
      units: "metric",
      yazio_sync_enabled: 0,
      food_database_country: "",
      update_check_enabled: 1,
      ai_enabled: 0,
      ai_base_url: "",
      ai_model: "",
      ai_system_prompt: "",
      agent_bridge_rev: 0,
      ai_provider: "openai" as const,
    })

    const result = (await byName("get_diary_summary").execute({})) as Record<string, unknown>
    expect(result.success).toBe(true)
    expect(result.totals).toEqual({ kcal: 200, protein: 4, carbs: 45, fat: 0.5 })
    expect(result.total_entries_in_diary).toBe(3)
    expect(mockGetEntries).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  })
})

describe("set_goals", () => {
  beforeEach(() => jest.clearAllMocks())

  it("updates provided goals and returns the new values", async () => {
    mockGetSettings.mockResolvedValue({
      calorie_goal: 2000,
      protein_goal: 150,
      carbs_goal: 200,
      fat_goal: 65,
      units: "metric",
      yazio_sync_enabled: 0,
      food_database_country: "",
      update_check_enabled: 1,
      ai_enabled: 0,
      ai_base_url: "",
      ai_model: "",
      ai_system_prompt: "",
      agent_bridge_rev: 0,
      ai_provider: "openai" as const,
    })

    const result = (await byName("set_goals").execute({ calorie_goal: 1800 })) as Record<
      string,
      unknown
    >
    expect(result.success).toBe(true)
    expect(mockUpdateSettings).toHaveBeenCalledWith({ calorie_goal: 1800 })
  })

  it("rejects an empty update", async () => {
    const result = (await byName("set_goals").execute({})) as Record<string, unknown>
    expect(result.success).toBe(false)
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })
})

describe("log_food", () => {
  beforeEach(() => jest.clearAllMocks())

  it("logs a manual entry with defaults", async () => {
    const result = (await byName("log_food").execute({
      name: "Oatmeal",
      kcal: 300,
      protein: 10,
    })) as Record<string, unknown>

    expect(result.success).toBe(true)
    expect(mockAddEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        food_name: "Oatmeal",
        kcal: 300,
        protein: 10,
        carbs: 0,
        meal_type: "snack",
      }),
    )
  })

  it("rejects missing names and non-positive kcal", async () => {
    const noName = (await byName("log_food").execute({ kcal: 100 })) as { success: boolean }
    const noKcal = (await byName("log_food").execute({ name: "X", kcal: 0 })) as {
      success: boolean
    }
    expect(noName.success).toBe(false)
    expect(noKcal.success).toBe(false)
    expect(mockAddEntry).not.toHaveBeenCalled()
  })
})

describe("delete_food_entry", () => {
  beforeEach(() => jest.clearAllMocks())

  it("deletes an existing entry", async () => {
    mockGetEntry.mockResolvedValue(entry())
    const result = (await byName("delete_food_entry").execute({ entry_id: "e1" })) as Record<
      string,
      unknown
    >
    expect(result.success).toBe(true)
    expect(mockRemoveEntry).toHaveBeenCalledWith("e1")
  })

  it("fails for unknown ids", async () => {
    mockGetEntry.mockResolvedValue(null)
    const result = (await byName("delete_food_entry").execute({ entry_id: "nope" })) as Record<
      string,
      unknown
    >
    expect(result.success).toBe(false)
    expect(mockRemoveEntry).not.toHaveBeenCalled()
  })
})

describe("search_foods", () => {
  beforeEach(() => jest.clearAllMocks())

  it("merges remote + cached results, dedupes and caps the list", async () => {
    mockSearchLocal.mockResolvedValue([food({ product_id: "p2", name: "Cached chicken" })])
    mockSearchRemote.mockResolvedValue([food(), food({ product_id: "p2" })])

    const result = (await byName("search_foods").execute({ query: "chicken", limit: 2 })) as Record<
      string,
      unknown
    >
    expect(result.success).toBe(true)
    const foods = result.foods as { product_id: string; per_100g: { kcal: number } }[]
    expect(foods).toHaveLength(2)
    expect(foods[0]).toMatchObject({ product_id: "p1", per_100g: { kcal: 165 } })
    expect(result.offline_only).toBe(false)
  })

  it("still answers from cache when remote fails", async () => {
    mockSearchLocal.mockResolvedValue([food()])
    mockSearchRemote.mockRejectedValue(new Error("offline"))

    const result = (await byName("search_foods").execute({ query: "chicken" })) as Record<
      string,
      unknown
    >
    expect(result.success).toBe(true)
    expect(result.offline_only).toBe(true)
  })

  it("rejects empty queries", async () => {
    const result = (await byName("search_foods").execute({})) as Record<string, unknown>
    expect(result.success).toBe(false)
  })
})

describe("get_settings / set_units", () => {
  beforeEach(() => jest.clearAllMocks())

  it("returns app settings flags", async () => {
    mockGetSettings.mockResolvedValue({
      calorie_goal: 2000,
      protein_goal: 150,
      carbs_goal: 200,
      fat_goal: 65,
      units: "metric",
      yazio_sync_enabled: 0,
      food_database_country: "DE",
      update_check_enabled: 1,
      ai_enabled: 0,
      ai_provider: "openai",
      ai_base_url: "",
      ai_model: "",
      ai_system_prompt: "",
      agent_bridge_rev: 0,
    })
    const result = (await byName("get_settings").execute({})) as Record<string, unknown>
    expect(result).toMatchObject({
      success: true,
      units: "metric",
      food_database_country: "DE",
      yazio_sync_enabled: false,
    })
  })

  it("set_units validates and saves", async () => {
    const ok = (await byName("set_units").execute({ units: "imperial" })) as Record<string, unknown>
    expect(ok.success).toBe(true)
    expect(mockUpdateSettings).toHaveBeenCalledWith({ units: "imperial" })

    const bad = (await byName("set_units").execute({ units: "parsecs" })) as Record<string, unknown>
    expect(bad.success).toBe(false)
  })
})

describe("update_food_entry", () => {
  beforeEach(() => jest.clearAllMocks())

  it("updates amount and meal type via the diary service", async () => {
    mockGetEntry.mockResolvedValue(entry({ meal_type: "lunch" }))
    mockUpdateEntry.mockResolvedValue(entry({ amount: 200, meal_type: "dinner" }))
    const result = (await byName("update_food_entry").execute({
      entry_id: "e1",
      amount: 200,
      meal_type: "dinner",
    })) as Record<string, unknown>
    expect(result.success).toBe(true)
    expect(mockUpdateEntry).toHaveBeenCalledWith({ id: "e1", amount: 200, mealType: "dinner" })
  })

  it("rejects unknown entries and bad amounts", async () => {
    mockGetEntry.mockResolvedValue(null)
    const unknown = (await byName("update_food_entry").execute({
      entry_id: "nope",
      amount: 5,
    })) as { success: boolean }
    expect(unknown.success).toBe(false)
    mockGetEntry.mockResolvedValue(entry())
    const badAmount = (await byName("update_food_entry").execute({
      entry_id: "e1",
      amount: -1,
    })) as { success: boolean }
    expect(badAmount.success).toBe(false)
    expect(mockUpdateEntry).not.toHaveBeenCalled()
  })
})

describe("get_diary_stats", () => {
  beforeEach(() => jest.clearAllMocks())

  it("returns per-day totals for the requested window", async () => {
    mockGetEntries.mockImplementation(async (date: string) =>
      date === "2026-08-08" ? [entry({ kcal: 500 })] : [],
    )
    const result = (await byName("get_diary_stats").execute({ days: 3 })) as {
      success: boolean
      days_count: number
      days_logged: number
      days: { date: string; kcal: number }[]
    }
    expect(result.success).toBe(true)
    expect(result.days_count).toBe(3)
    expect(result.days_logged).toBe(1)
    expect(result.days).toHaveLength(3)
    expect(result.days.find((d) => d.date === "2026-08-08")?.kcal).toBe(500)
  })

  it("caps the window at 30 days", async () => {
    mockGetEntries.mockResolvedValue([])
    const result = (await byName("get_diary_stats").execute({ days: 99 })) as {
      days_count: number
    }
    expect(result.days_count).toBe(30)
  })
})

describe("get_meals / log_meal", () => {
  beforeEach(() => jest.clearAllMocks())

  it("lists meals with totals", async () => {
    mockListMeals.mockResolvedValue([meal()])
    ;(mealTotals as jest.Mock).mockReturnValue({ kcal: 150, protein: 3, carbs: 33, fat: 0.5 })
    const result = (await byName("get_meals").execute({})) as {
      success: boolean
      meals: { id: string; name: string; kcal: number }[]
    }
    expect(result.success).toBe(true)
    expect(result.meals[0]).toMatchObject({ id: "meal-1", name: "Cornflakes with milk", kcal: 150 })
  })

  it("logs a meal into the diary", async () => {
    mockListMeals.mockResolvedValue([meal()])
    mockLogMeal.mockResolvedValue({ logged: 2, skipped: [] })
    const result = (await byName("log_meal").execute({
      meal_id: "meal-1",
      date: "2026-08-08",
      meal_type: "breakfast",
    })) as Record<string, unknown>
    expect(result.success).toBe(true)
    expect(result.logged_items).toBe(2)
    expect(mockLogMeal).toHaveBeenCalledWith(
      expect.objectContaining({ date: "2026-08-08", mealType: "breakfast" }),
    )
  })

  it("rejects unknown meals", async () => {
    mockListMeals.mockResolvedValue([meal()])
    const result = (await byName("log_meal").execute({ meal_id: "nope" })) as Record<
      string,
      unknown
    >
    expect(result.success).toBe(false)
    expect(mockLogMeal).not.toHaveBeenCalled()
  })
})
