import * as diaryDb from "@/db/diary"
import * as settingsDb from "@/db/settings"
import * as waterDb from "@/db/water"
import * as weightDb from "@/db/weight"
import * as mealsDb from "@/db/meals"
import * as foodCacheDb from "@/db/food-cache"
import { searchFoodsRemote } from "@/services/yazio/foods"
import { updateDiaryEntry as updateDiaryEntryService } from "@/services/diary"
import { listMeals, logMealToDiary, mealTotals } from "@/services/meals"
import { createDiaryTools, summarizeEntries } from "../diary-tools"
import type { DiaryEntry, Meal, SearchFoodResult, WaterEntry, WeightEntry } from "@/types"

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

jest.mock("@/db/water", () => ({
  getWaterEntriesForDate: jest.fn().mockResolvedValue([]),
  getWaterTotalForDate: jest.fn().mockResolvedValue(0),
  addWaterEntry: jest.fn(),
  deleteWaterEntry: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/db/weight", () => ({
  getWeightEntries: jest.fn().mockResolvedValue([]),
  getRecentWeightEntries: jest.fn().mockResolvedValue([]),
  getWeightEntryForDate: jest.fn().mockResolvedValue(null),
  saveWeightEntry: jest.fn().mockResolvedValue(undefined),
  deleteWeightEntry: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/db/meals", () => ({
  getMeals: jest.fn().mockResolvedValue([]),
  getMealById: jest.fn().mockResolvedValue(null),
  saveMeal: jest.fn().mockResolvedValue(undefined),
  deleteMeal: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/db/food-cache", () => ({
  searchLocalFoods: jest.fn(),
  getFavoriteFoods: jest.fn().mockResolvedValue([]),
  toggleFavorite: jest.fn().mockResolvedValue(true),
  getRecentFoodUsages: jest.fn().mockResolvedValue([]),
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

const defaultSettings = () => ({
  calorie_goal: 2000,
  protein_goal: 150,
  carbs_goal: 200,
  fat_goal: 65,
  units: "metric",
  yazio_sync_enabled: 0,
  food_database_country: "US",
  update_check_enabled: 1,
  ai_enabled: 0,
  ai_base_url: "",
  ai_model: "",
  ai_system_prompt: "",
  agent_bridge_rev: 0,
  theme_preference: "system" as const,
  ai_provider: "openai" as const,
  water_goal_ml: 2500,
  height_cm: 180,
  target_weight_kg: 75,
})

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
    mockGetSettings.mockResolvedValue(defaultSettings())

    const result = (await byName("get_diary_summary").execute({})) as Record<string, unknown>
    expect(result.success).toBe(true)
    expect(result.totals).toEqual({ kcal: 200, protein: 4, carbs: 45, fat: 0.5 })
    expect(result.total_entries_in_diary).toBe(3)
    expect(mockGetEntries).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  })
})

describe("set_goals / get_goals", () => {
  beforeEach(() => jest.clearAllMocks())

  it("updates provided goals including water and target weight", async () => {
    mockGetSettings.mockResolvedValue(defaultSettings())

    const result = (await byName("set_goals").execute({
      calorie_goal: 1800,
      water_goal_ml: 3000,
      target_weight_kg: 70,
    })) as Record<string, unknown>
    expect(result.success).toBe(true)
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      calorie_goal: 1800,
      water_goal_ml: 3000,
      target_weight_kg: 70,
    })
  })

  it("get_goals returns full goals profile", async () => {
    mockGetSettings.mockResolvedValue(defaultSettings())
    const result = (await byName("get_goals").execute({})) as Record<string, unknown>
    expect(result.success).toBe(true)
    expect(result.water_goal_ml).toBe(2500)
    expect(result.target_weight_kg).toBe(75)
    expect(result.height_cm).toBe(180)
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

describe("water tools", () => {
  beforeEach(() => jest.clearAllMocks())

  it("get_water returns logs, totals, and goal progress", async () => {
    const mockWater: WaterEntry[] = [
      { id: "w1", date: "2026-08-08", amount_ml: 500, created_at: "2026-08-08T09:00:00Z" },
    ]
    ;(waterDb.getWaterEntriesForDate as jest.Mock).mockResolvedValue(mockWater)
    ;(waterDb.getWaterTotalForDate as jest.Mock).mockResolvedValue(500)
    mockGetSettings.mockResolvedValue(defaultSettings())

    const result = (await byName("get_water").execute({ date: "2026-08-08" })) as Record<
      string,
      unknown
    >
    expect(result.success).toBe(true)
    expect(result.total_ml).toBe(500)
    expect(result.goal_ml).toBe(2500)
    expect(result.progress_percent).toBe(20)
  })

  it("log_water adds water entry and validates input", async () => {
    ;(waterDb.addWaterEntry as jest.Mock).mockResolvedValue({
      id: "w2",
      date: "2026-08-08",
      amount_ml: 250,
      created_at: "2026-08-08T10:00:00Z",
    })
    ;(waterDb.getWaterTotalForDate as jest.Mock).mockResolvedValue(250)
    mockGetSettings.mockResolvedValue(defaultSettings())

    const result = (await byName("log_water").execute({
      amount_ml: 250,
      date: "2026-08-08",
    })) as Record<string, unknown>
    expect(result.success).toBe(true)
    expect(waterDb.addWaterEntry).toHaveBeenCalledWith({ date: "2026-08-08", amountMl: 250 })

    const bad = (await byName("log_water").execute({ amount_ml: -50 })) as { success: boolean }
    expect(bad.success).toBe(false)
  })

  it("delete_water_entry removes entry", async () => {
    const result = (await byName("delete_water_entry").execute({ entry_id: "w1" })) as Record<
      string,
      unknown
    >
    expect(result.success).toBe(true)
    expect(waterDb.deleteWaterEntry).toHaveBeenCalledWith("w1")
  })
})

describe("weight tools", () => {
  beforeEach(() => jest.clearAllMocks())

  it("get_weight returns weight entries, latest weight, BMI, and delta", async () => {
    const mockWeights: WeightEntry[] = [
      {
        id: "wt1",
        date: "2026-08-08",
        weight_kg: 75.0,
        note: "Morning",
        created_at: "2026-08-08T07:00:00Z",
      },
      {
        id: "wt2",
        date: "2026-08-01",
        weight_kg: 76.0,
        note: null,
        created_at: "2026-08-01T07:00:00Z",
      },
    ]
    ;(weightDb.getRecentWeightEntries as jest.Mock).mockResolvedValue(mockWeights)
    mockGetSettings.mockResolvedValue(defaultSettings())

    const result = (await byName("get_weight").execute({ limit: 5 })) as Record<string, unknown>
    expect(result.success).toBe(true)
    const latest = result.latest_weight as Record<string, unknown>
    expect(latest.weight_kg).toBe(75)
    expect(latest.bmi).toBe(23.1)
    expect(latest.delta_from_previous_kg).toBe(-1)
  })

  it("log_weight saves weight and calculates BMI", async () => {
    mockGetSettings.mockResolvedValue(defaultSettings())
    const result = (await byName("log_weight").execute({
      weight_kg: 74.5,
      date: "2026-08-08",
      note: "Post-run",
    })) as Record<string, unknown>
    expect(result.success).toBe(true)
    expect(weightDb.saveWeightEntry).toHaveBeenCalledWith({
      date: "2026-08-08",
      weightKg: 74.5,
      note: "Post-run",
    })
    expect(result.bmi).toBe(23)
  })

  it("delete_weight_entry deletes entry", async () => {
    const result = (await byName("delete_weight_entry").execute({ entry_id: "wt1" })) as Record<
      string,
      unknown
    >
    expect(result.success).toBe(true)
    expect(weightDb.deleteWeightEntry).toHaveBeenCalledWith("wt1")
  })
})

describe("search_foods & favorites / recents", () => {
  beforeEach(() => jest.clearAllMocks())

  it("merges remote + cached results", async () => {
    mockSearchLocal.mockResolvedValue([food({ product_id: "p2", name: "Cached chicken" })])
    mockSearchRemote.mockResolvedValue([food(), food({ product_id: "p2" })])

    const result = (await byName("search_foods").execute({ query: "chicken", limit: 2 })) as Record<
      string,
      unknown
    >
    expect(result.success).toBe(true)
    const foods = result.foods as { product_id: string }[]
    expect(foods).toHaveLength(2)
  })

  it("get_favorite_foods returns favorites", async () => {
    ;(foodCacheDb.getFavoriteFoods as jest.Mock).mockResolvedValue([food({ is_verified: true })])
    const result = (await byName("get_favorite_foods").execute({})) as Record<string, unknown>
    expect(result.success).toBe(true)
    expect(result.foods).toHaveLength(1)
  })

  it("toggle_favorite_food toggles food star", async () => {
    ;(foodCacheDb.toggleFavorite as jest.Mock).mockResolvedValue(true)
    const result = (await byName("toggle_favorite_food").execute({
      product_id: "p1",
      name: "Chicken",
      kcal: 165,
    })) as Record<string, unknown>
    expect(result.success).toBe(true)
    expect(result.is_favorite).toBe(true)
  })

  it("get_recent_foods returns recent usages", async () => {
    ;(foodCacheDb.getRecentFoodUsages as jest.Mock).mockResolvedValue([
      { food: food(), amount: 150, lastLoggedAt: "2026-08-08T12:00:00Z" },
    ])
    const result = (await byName("get_recent_foods").execute({ limit: 5 })) as Record<
      string,
      unknown
    >
    expect(result.success).toBe(true)
    expect(result.recent_foods).toHaveLength(1)
  })
})

describe("get_settings / set_units / set_profile", () => {
  beforeEach(() => jest.clearAllMocks())

  it("returns app settings flags and profile data", async () => {
    mockGetSettings.mockResolvedValue(defaultSettings())
    const result = (await byName("get_settings").execute({})) as Record<string, unknown>
    expect(result).toMatchObject({
      success: true,
      units: "metric",
      food_database_country: "US",
      water_goal_ml: 2500,
      height_cm: 180,
      target_weight_kg: 75,
    })
  })

  it("set_units validates and saves", async () => {
    const ok = (await byName("set_units").execute({ units: "imperial" })) as Record<string, unknown>
    expect(ok.success).toBe(true)
    expect(mockUpdateSettings).toHaveBeenCalledWith({ units: "imperial" })
  })

  it("set_profile updates profile metrics", async () => {
    mockGetSettings.mockResolvedValue(defaultSettings())
    const result = (await byName("set_profile").execute({
      height_cm: 185,
      target_weight_kg: 78,
      theme_preference: "dark",
    })) as Record<string, unknown>
    expect(result.success).toBe(true)
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      height_cm: 185,
      target_weight_kg: 78,
      theme_preference: "dark",
    })
  })
})

describe("saved meals: get, save, delete, log", () => {
  beforeEach(() => jest.clearAllMocks())

  it("lists meals with items breakdown", async () => {
    mockListMeals.mockResolvedValue([meal()])
    ;(mealTotals as jest.Mock).mockReturnValue({ kcal: 150, protein: 3, carbs: 33, fat: 0.5 })
    const result = (await byName("get_meals").execute({})) as {
      success: boolean
      meals: { id: string; name: string; items: unknown[] }[]
    }
    expect(result.success).toBe(true)
    expect(result.meals[0].items).toHaveLength(1)
  })

  it("save_meal creates a meal template", async () => {
    const result = (await byName("save_meal").execute({
      name: "Oat Bowl",
      items: [{ name: "Oats", amount: 50, kcal: 190, protein: 6, carbs: 34, fat: 3 }],
    })) as Record<string, unknown>
    expect(result.success).toBe(true)
    expect(mealsDb.saveMeal).toHaveBeenCalledWith(expect.objectContaining({ name: "Oat Bowl" }))
  })

  it("delete_meal removes a saved meal", async () => {
    const result = (await byName("delete_meal").execute({ meal_id: "meal-1" })) as Record<
      string,
      unknown
    >
    expect(result.success).toBe(true)
    expect(mealsDb.deleteMeal).toHaveBeenCalledWith("meal-1")
  })

  it("log_meal logs meal items to diary", async () => {
    mockListMeals.mockResolvedValue([meal()])
    mockLogMeal.mockResolvedValue({ logged: 1, skipped: [] })
    const result = (await byName("log_meal").execute({
      meal_id: "meal-1",
      date: "2026-08-08",
      meal_type: "lunch",
    })) as Record<string, unknown>
    expect(result.success).toBe(true)
    expect(mockLogMeal).toHaveBeenCalledWith(
      expect.objectContaining({ date: "2026-08-08", mealType: "lunch" }),
    )
  })
})

describe("update_food_entry", () => {
  beforeEach(() => jest.clearAllMocks())

  it("updates amount and meal type via diary service", async () => {
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
})

describe("get_health_summary", () => {
  beforeEach(() => jest.clearAllMocks())

  it("calculates averages and trends across nutrition, water, and weight", async () => {
    mockGetSettings.mockResolvedValue(defaultSettings())
    mockGetEntries.mockResolvedValue([entry({ kcal: 2000, protein: 150, carbs: 200, fat: 65 })])
    ;(waterDb.getWaterTotalForDate as jest.Mock).mockResolvedValue(2500)
    ;(weightDb.getWeightEntries as jest.Mock).mockResolvedValue([
      { id: "wt1", date: "2026-08-01", weight_kg: 76, note: null, created_at: "" },
      { id: "wt2", date: "2026-08-07", weight_kg: 75, note: null, created_at: "" },
    ])

    const result = (await byName("get_health_summary").execute({ days: 7 })) as Record<
      string,
      unknown
    >
    expect(result.success).toBe(true)
    expect(result.period_days).toBe(7)
    const averages = result.averages as Record<string, unknown>
    expect(averages.kcal).toBe(2000)
    expect(averages.water_ml).toBe(2500)
    const weightTrend = result.weight_trend as Record<string, unknown>
    expect(weightTrend.delta_kg).toBe(-1)
  })
})
