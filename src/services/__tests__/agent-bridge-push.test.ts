import * as diaryDb from "@/db/diary"
import * as settingsDb from "@/db/settings"
import { pushSnapshot, pullAgentChanges } from "../agent-bridge"
import type { DiaryEntry } from "@/types"

jest.mock("@/db/diary", () => ({
  getDiaryEntriesForDate: jest.fn(),
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
}))

jest.mock("@/db/weight", () => ({
  getWeightEntries: jest.fn().mockResolvedValue([]),
}))

jest.mock("@/db/food-cache", () => ({
  getFavoriteFoods: jest.fn().mockResolvedValue([]),
}))

jest.mock("@/services/meals", () => ({
  listMeals: jest.fn().mockResolvedValue([]),
  mealTotals: jest.fn(() => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 })),
  logMealToDiary: jest.fn().mockResolvedValue({ logged: 1, skipped: [] }),
}))

const mockGetEntries = diaryDb.getDiaryEntriesForDate as jest.MockedFunction<
  typeof diaryDb.getDiaryEntriesForDate
>
const mockGetEntry = diaryDb.getDiaryEntryById as jest.MockedFunction<
  typeof diaryDb.getDiaryEntryById
>
const mockAddEntry = diaryDb.addDiaryEntry as jest.MockedFunction<typeof diaryDb.addDiaryEntry>
const mockGetSettings = settingsDb.getSettings as jest.MockedFunction<typeof settingsDb.getSettings>
const mockUpdateSettings = settingsDb.updateSettings as jest.MockedFunction<
  typeof settingsDb.updateSettings
>

const settings = (overrides: Partial<ReturnType<typeof settingsRow>> = {}) => {
  return { ...settingsRow(), ...overrides }
}

function settingsRow() {
  return {
    calorie_goal: 2000,
    protein_goal: 150,
    carbs_goal: 200,
    fat_goal: 65,
    units: "metric",
    yazio_sync_enabled: 0,
    food_database_country: "",
    update_check_enabled: 1,
    ai_enabled: 0,
    ai_provider: "openai" as const,
    ai_base_url: "",
    ai_model: "",
    ai_system_prompt: "",
    agent_bridge_rev: 0,
    theme_preference: "system" as const,
    water_goal_ml: 2500,
    height_cm: 0,
    target_weight_kg: 0,
  }
}

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

describe("pushSnapshot", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    // Web-only guard: the bridge is available when a window exists.
    ;(globalThis as Record<string, unknown>).window = {} as Window
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete (globalThis as Record<string, unknown>).window
    jest.clearAllMocks()
  })

  it("posts the last 14 days of diary plus goals, water, weight, and meals", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock as unknown as typeof fetch
    mockGetEntries.mockResolvedValue([entry()])
    mockGetSettings.mockResolvedValue(settings())

    await pushSnapshot()

    expect(mockGetEntries).toHaveBeenCalledTimes(14)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent/snapshot",
      expect.objectContaining({ method: "POST" }),
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.diary).toHaveLength(14)
    expect(body.diary[0]).toMatchObject({ id: "e1", food_name: "Rice", kcal: 200 })
    expect(body.settings.calorie_goal).toBe(2000)
    expect(body.settings.water_goal_ml).toBe(2500)
    expect(body.water).toBeDefined()
    expect(body.weight).toBeDefined()
    expect(body.favorites).toBeDefined()
  })

  it("throws when the server rejects the snapshot", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 400 }) as unknown as typeof fetch
    mockGetEntries.mockResolvedValue([])
    mockGetSettings.mockResolvedValue(settings())
    await expect(pushSnapshot()).rejects.toThrow("HTTP 400")
  })
})

describe("pullAgentChanges", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    ;(globalThis as Record<string, unknown>).window = {} as Window
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete (globalThis as Record<string, unknown>).window
    jest.clearAllMocks()
  })

  it("applies changes newer than the stored revision and advances it", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        revision: 9,
        changes: [
          {
            seq: 8,
            op: "log_food",
            payload: { id: "agent-1", food_name: "Oats", kcal: 250, date: "2026-08-08" },
            at: "2026-08-08T15:00:00.000Z",
          },
        ],
      }),
    }) as unknown as typeof fetch
    mockGetSettings.mockResolvedValue(settings({ agent_bridge_rev: 7 }))
    mockGetEntry.mockResolvedValue(null)

    await pullAgentChanges()

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/agent/changes?since=7")
    expect(mockAddEntry).toHaveBeenCalledWith(expect.objectContaining({ id: "agent-1" }))
    expect(mockUpdateSettings).toHaveBeenCalledWith({ agent_bridge_rev: 9 })
  })

  it("does nothing when there are no changes", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ revision: 7, changes: [] }),
    }) as unknown as typeof fetch
    mockGetSettings.mockResolvedValue(settings({ agent_bridge_rev: 7 }))

    await pullAgentChanges()

    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it("stays quiet when the server is unreachable or rejects", async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError("offline")) as unknown as typeof fetch
    mockGetSettings.mockResolvedValue(settings())
    await expect(pullAgentChanges()).resolves.toBeUndefined()

    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch
    await expect(pullAgentChanges()).resolves.toBeUndefined()
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })
})
