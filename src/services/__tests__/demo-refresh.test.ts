import { toDateKey, shiftDateKey } from "@/utils/date"
import { DEMO_LAST_SEED_KEY, ensureFreshDemoSession, hasFreshDemoDataForToday } from "../demo"
import { getDatabase } from "@/db/database"
import { getSecureItem, setSecureItem } from "@/utils/secure-storage"
import { getActiveAccountId, isLoggedIn } from "@/services/yazio/auth-storage"
import { hasDemoData } from "@/db/user-data"

jest.mock("@/db/database", () => ({
  getDatabase: jest.fn(),
}))

jest.mock("@/utils/secure-storage", () => ({
  getSecureItem: jest.fn(),
  setSecureItem: jest.fn(),
  deleteSecureItem: jest.fn(),
}))

jest.mock("@/services/yazio/auth-storage", () => ({
  getActiveAccountId: jest.fn(),
  isLoggedIn: jest.fn(),
  setDemoLoggedIn: jest.fn(),
}))

jest.mock("@/db/user-data", () => ({
  hasDemoData: jest.fn(),
}))

jest.mock("@/db/food-cache", () => ({
  saveFoodToCache: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/db/diary", () => ({
  addDiaryEntry: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/db/meals", () => ({
  saveMeal: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/db/settings", () => ({
  updateSettings: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/services/account", () => ({
  ensureAccountDataIsolation: jest.fn().mockResolvedValue(undefined),
}))

const mockGetDatabase = getDatabase as jest.Mock
const mockGetSecureItem = getSecureItem as jest.Mock
const mockSetSecureItem = setSecureItem as jest.Mock
const mockGetActiveAccountId = getActiveAccountId as jest.Mock
const mockIsLoggedIn = isLoggedIn as jest.Mock
const mockHasDemoData = hasDemoData as jest.Mock

function mockDb(firstCounts: number[] = [0, 0, 0]) {
  const getFirstAsync = jest.fn(async () => ({ c: firstCounts.shift() ?? 0 }))
  mockGetDatabase.mockResolvedValue({
    runAsync: jest.fn().mockResolvedValue(undefined),
    execAsync: jest.fn().mockResolvedValue(undefined),
    getFirstAsync,
  })
}

describe("hasFreshDemoDataForToday", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("is true when any dated demo table covers today", async () => {
    mockDb([0, 1, 0])
    await expect(hasFreshDemoDataForToday("2026-11-12")).resolves.toBe(true)
  })

  it("is false when no demo rows cover today", async () => {
    mockDb([0, 0, 0])
    await expect(hasFreshDemoDataForToday("2026-11-12")).resolves.toBe(false)
  })
})

describe("ensureFreshDemoSession", () => {
  const today = toDateKey()
  const yesterday = shiftDateKey(today, -1)

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetActiveAccountId.mockResolvedValue("demo")
    mockIsLoggedIn.mockResolvedValue(true)
    delete (globalThis as { window?: unknown }).window
  })

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it("skips real accounts without touching the database", async () => {
    mockGetActiveAccountId.mockResolvedValue("user@example.com")
    await expect(ensureFreshDemoSession()).resolves.toBe(false)
    expect(mockGetDatabase).not.toHaveBeenCalled()
  })

  it("skips the same-day repeat boot without reseeding", async () => {
    mockGetSecureItem.mockResolvedValue(today)
    mockDb()
    await expect(ensureFreshDemoSession()).resolves.toBe(false)
    expect(mockHasDemoData).not.toHaveBeenCalled()
    expect(mockSetSecureItem).not.toHaveBeenCalled()
  })

  it("leaves empty fake-auth sessions alone", async () => {
    mockGetSecureItem.mockResolvedValue(null)
    mockHasDemoData.mockResolvedValue(false)
    mockDb([0, 0, 0])
    await expect(ensureFreshDemoSession()).resolves.toBe(false)
    expect(mockSetSecureItem).not.toHaveBeenCalledWith(DEMO_LAST_SEED_KEY, expect.anything())
  })

  it("reseeds once on the first boot of a new day", async () => {
    mockGetSecureItem.mockResolvedValue(yesterday)
    mockHasDemoData.mockResolvedValue(true)
    mockDb()
    await expect(ensureFreshDemoSession()).resolves.toBe(true)
    expect(mockSetSecureItem).toHaveBeenCalledWith(DEMO_LAST_SEED_KEY, today)
  })

  it("adopts legacy installs that already cover today without reseeding", async () => {
    mockGetSecureItem.mockResolvedValue(null)
    mockHasDemoData.mockResolvedValue(true)
    mockDb([1, 0, 0])
    await expect(ensureFreshDemoSession()).resolves.toBe(false)
    expect(mockSetSecureItem).toHaveBeenCalledWith(DEMO_LAST_SEED_KEY, today)
  })

  it("reseeds legacy installs whose data went stale", async () => {
    mockGetSecureItem.mockResolvedValue(null)
    mockHasDemoData.mockResolvedValue(true)
    mockDb([0, 0, 0])
    await expect(ensureFreshDemoSession()).resolves.toBe(true)
    expect(mockSetSecureItem).toHaveBeenCalledWith(DEMO_LAST_SEED_KEY, today)
  })

  it("always reseeds explicit ?demo=1 visits", async () => {
    mockGetSecureItem.mockResolvedValue(today)
    ;(globalThis as { window?: unknown }).window = { location: { search: "?demo=1" } }
    mockDb()
    await expect(ensureFreshDemoSession()).resolves.toBe(true)
  })
})
