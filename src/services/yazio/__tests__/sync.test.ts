import { isLocalOnlyEntry, syncEntryToYazio, syncPendingEntries } from "../sync"
import * as diaryDb from "@/db/diary"
import { getSettings } from "@/db/settings"
import { ensureYazioClient } from "../client"
import { getFoodRemote } from "../foods"

jest.mock("@/db/diary", () => ({
  reserveYazioItemId: jest.fn().mockResolvedValue(undefined),
  markDiaryEntrySynced: jest.fn().mockResolvedValue(undefined),
  markDiaryEntryUnsynced: jest.fn().mockResolvedValue(undefined),
  getUnsyncedEntries: jest.fn().mockResolvedValue([]),
}))

jest.mock("@/db/settings", () => ({
  getSettings: jest.fn(),
}))

jest.mock("../client", () => ({
  ensureYazioClient: jest.fn(),
}))

jest.mock("../foods", () => ({
  getFoodRemote: jest.fn(),
}))

jest.mock("@/utils/retry", () => {
  const actual = jest.requireActual("@/utils/retry")
  return { ...actual, withRetry: jest.fn((fn: () => Promise<unknown>) => fn()) }
})

const mockSettings = getSettings as jest.Mock
const mockEnsure = ensureYazioClient as jest.Mock
const mockFood = getFoodRemote as jest.Mock

const entry = (overrides = {}) => ({
  id: "e1",
  date: "2026-08-08",
  meal_type: "lunch",
  food_id: "p1",
  food_name: "Banana",
  amount: 100,
  unit: "g",
  kcal: 89,
  protein: 1,
  carbs: 23,
  fat: 0,
  created_at: "2026-08-08T10:00:00.000Z",
  yazio_synced: 0,
  yazio_item_id: null,
  ...overrides,
})

const food = {
  product_id: "p1",
  name: "Banana",
  producer: "",
  nutrients: { kcal: 89, protein: 1, carbs: 23, fat: 0 },
  serving: { serving: "100 g", amount: 100, serving_quantity: 100 },
  base_unit: "g",
  is_verified: true,
}

describe("isLocalOnlyEntry", () => {
  it("marks imported simple and recipe rows as local only", () => {
    expect(isLocalOnlyEntry({ food_id: null, yazio_item_id: "y1" })).toBe(true)
    expect(isLocalOnlyEntry({ food_id: "p1", yazio_item_id: "y1" })).toBe(false)
    expect(isLocalOnlyEntry({ food_id: null, yazio_item_id: null })).toBe(false)
  })
})

describe("syncEntryToYazio", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSettings.mockResolvedValue({ yazio_sync_enabled: 1 })
    mockFood.mockResolvedValue(food)
  })

  it("pushes with the same id and never deletes before push", async () => {
    const remove = jest.fn()
    const add = jest.fn().mockResolvedValue(undefined)
    mockEnsure.mockResolvedValue({ user: { addConsumedItem: add, removeConsumedItem: remove } })
    const ok = await syncEntryToYazio(entry({ yazio_synced: 1, yazio_item_id: "y1" }) as never)
    expect(ok).toBe(true)
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ id: "y1" }))
    expect(remove).not.toHaveBeenCalled()
    expect(diaryDb.markDiaryEntrySynced).toHaveBeenCalledWith("e1", "y1")
  })

  it("marks the row unsynced when the push fails", async () => {
    mockEnsure.mockResolvedValue({
      user: {
        addConsumedItem: jest.fn().mockRejectedValue(new Error("offline")),
        removeConsumedItem: jest.fn(),
      },
    })
    const ok = await syncEntryToYazio(entry() as never)
    expect(ok).toBe(false)
    expect(diaryDb.markDiaryEntryUnsynced).toHaveBeenCalledWith("e1")
  })

  it("skips when sync is disabled or no product", async () => {
    mockSettings.mockResolvedValue({ yazio_sync_enabled: 0 })
    await expect(syncEntryToYazio(entry() as never)).resolves.toBe(false)
    mockSettings.mockResolvedValue({ yazio_sync_enabled: 1 })
    await expect(syncEntryToYazio(entry({ food_id: null }) as never)).resolves.toBe(false)
  })
})

describe("syncPendingEntries", () => {
  it("returns 0 when sync is disabled", async () => {
    mockSettings.mockResolvedValue({ yazio_sync_enabled: 0 })
    await expect(syncPendingEntries()).resolves.toBe(0)
  })
})
