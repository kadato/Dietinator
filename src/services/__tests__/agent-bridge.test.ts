import * as diaryDb from "@/db/diary"
import * as settingsDb from "@/db/settings"
import * as mealsService from "@/services/meals"
import { applyChange, type AgentChange } from "../agent-bridge"
import type { DiaryEntry } from "@/types"

jest.mock("@/db/diary", () => ({
  getDiaryEntriesForDate: jest.fn(),
  getDiaryEntryById: jest.fn(),
  addDiaryEntry: jest.fn(),
  removeDiaryEntry: jest.fn(),
  updateDiaryEntryDetails: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/db/settings", () => ({
  getSettings: jest.fn(),
  updateSettings: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/services/meals", () => ({
  listMeals: jest.fn().mockResolvedValue([]),
  mealTotals: jest.fn(() => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 })),
  logMealToDiary: jest.fn().mockResolvedValue({ logged: 1, skipped: [] }),
}))

const mockGetEntryById = diaryDb.getDiaryEntryById as jest.MockedFunction<
  typeof diaryDb.getDiaryEntryById
>
const mockAddEntry = diaryDb.addDiaryEntry as jest.MockedFunction<typeof diaryDb.addDiaryEntry>
const mockRemoveEntry = diaryDb.removeDiaryEntry as jest.MockedFunction<
  typeof diaryDb.removeDiaryEntry
>
const mockUpdateEntryDetails = diaryDb.updateDiaryEntryDetails as jest.MockedFunction<
  typeof diaryDb.updateDiaryEntryDetails
>
const mockUpdateSettings = settingsDb.updateSettings as jest.MockedFunction<
  typeof settingsDb.updateSettings
>
const mockListMeals = mealsService.listMeals as jest.MockedFunction<typeof mealsService.listMeals>
const mockLogMeal = mealsService.logMealToDiary as jest.MockedFunction<
  typeof mealsService.logMealToDiary
>

const existingEntry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: "e1",
  date: "2026-08-08",
  meal_type: "lunch",
  food_id: null,
  food_name: "Oats",
  amount: 1,
  unit: "serving",
  kcal: 250,
  protein: 10,
  carbs: 40,
  fat: 5,
  created_at: "2026-08-08T12:00:00.000Z",
  yazio_synced: 0,
  yazio_item_id: null,
  ...overrides,
})

function change(overrides: Partial<AgentChange> = {}): AgentChange {
  return {
    seq: 7,
    op: "log_food",
    payload: {
      id: "agent-1",
      date: "2026-08-08",
      meal_type: "snack",
      food_name: "Almonds",
      amount: 1,
      unit: "serving",
      kcal: 160,
      protein: 6,
      carbs: 6,
      fat: 14,
      created_at: "2026-08-08T15:00:00.000Z",
    },
    at: "2026-08-08T15:00:00.000Z",
    ...overrides,
  }
}

describe("applyChange", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("applies a log_food change as a new diary entry", async () => {
    mockGetEntryById.mockResolvedValue(null)
    await applyChange(change())

    expect(mockAddEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "agent-1",
        date: "2026-08-08",
        meal_type: "snack",
        food_name: "Almonds",
        kcal: 160,
        protein: 6,
        carbs: 6,
        fat: 14,
        yazio_synced: 0,
        yazio_item_id: null,
      }),
    )
  })

  it("skips a log_food change when the entry already exists", async () => {
    mockGetEntryById.mockResolvedValue(existingEntry({ id: "agent-1" }))
    await applyChange(change())
    expect(mockAddEntry).not.toHaveBeenCalled()
  })

  it("ignores invalid log_food payloads (missing name or kcal)", async () => {
    await applyChange(change({ payload: { id: "x", food_name: "" } }))
    await applyChange(change({ payload: { id: "y", food_name: "Food", kcal: 0 } }))
    expect(mockAddEntry).not.toHaveBeenCalled()
  })

  it("normalizes bad meal types to snack", async () => {
    mockGetEntryById.mockResolvedValue(null)
    await applyChange(change({ payload: { ...change().payload, meal_type: "brunch" } }))
    expect(mockAddEntry).toHaveBeenCalledWith(expect.objectContaining({ meal_type: "snack" }))
  })

  it("applies a delete_entry change only for existing entries", async () => {
    mockGetEntryById.mockResolvedValue(existingEntry())
    await applyChange(change({ op: "delete_entry", payload: { id: "e1" } }))
    expect(mockRemoveEntry).toHaveBeenCalledWith("e1")

    mockGetEntryById.mockResolvedValue(null)
    await applyChange(change({ op: "delete_entry", payload: { id: "gone" } }))
    expect(mockRemoveEntry).toHaveBeenCalledTimes(1)
  })

  it("applies set_goals changes with positive-number validation", async () => {
    await applyChange(
      change({ op: "set_goals", payload: { calorie_goal: 1800, protein_goal: 140 } }),
    )
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      calorie_goal: 1800,
      protein_goal: 140,
    })

    mockUpdateSettings.mockClear()
    await applyChange(change({ op: "set_goals", payload: { calorie_goal: -5 } }))
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it("ignores unknown ops", async () => {
    await applyChange(change({ op: "mystery" as AgentChange["op"] }))
    expect(mockAddEntry).not.toHaveBeenCalled()
    expect(mockRemoveEntry).not.toHaveBeenCalled()
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it("applies update_food_entry by scaling stored nutrients", async () => {
    mockGetEntryById.mockResolvedValue(existingEntry({ amount: 100, kcal: 200 }))
    await applyChange(
      change({
        op: "update_food_entry",
        payload: { id: "e1", amount: 50, meal_type: "dinner" },
      }),
    )
    expect(mockUpdateEntryDetails).toHaveBeenCalledWith(
      "e1",
      expect.objectContaining({
        amount: 50,
        meal_type: "dinner",
        nutrients: { kcal: 100, protein: 5, carbs: 20, fat: 2.5 },
      }),
    )
  })

  it("ignores invalid update_food_entry payloads", async () => {
    await applyChange(change({ op: "update_food_entry", payload: { id: "e1", amount: -3 } }))
    await applyChange(change({ op: "update_food_entry", payload: { amount: 10 } }))
    mockGetEntryById.mockResolvedValue(null)
    await applyChange(change({ op: "update_food_entry", payload: { id: "gone", amount: 10 } }))
    expect(mockUpdateEntryDetails).not.toHaveBeenCalled()
  })

  it("applies set_units changes with validation", async () => {
    await applyChange(change({ op: "set_units", payload: { units: "imperial" } }))
    expect(mockUpdateSettings).toHaveBeenCalledWith({ units: "imperial" })

    mockUpdateSettings.mockClear()
    await applyChange(change({ op: "set_units", payload: { units: "parsecs" } }))
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it("applies log_meal changes against the local meal list", async () => {
    mockListMeals.mockResolvedValue([
      {
        id: "meal-1",
        name: "Cornflakes with milk",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        last_used_at: null,
        items: [],
      },
    ])
    await applyChange(
      change({
        op: "log_meal",
        payload: { meal_id: "meal-1", date: "2026-08-08", meal_type: "breakfast" },
      }),
    )
    expect(mockLogMeal).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-08-08",
        mealType: "breakfast",
        meal: expect.objectContaining({ id: "meal-1" }),
      }),
    )
  })

  it("skips log_meal for unknown meals", async () => {
    mockListMeals.mockResolvedValue([])
    await applyChange(change({ op: "log_meal", payload: { meal_id: "nope" } }))
    expect(mockLogMeal).not.toHaveBeenCalled()
  })
})
