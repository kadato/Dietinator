import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"
import { deleteSecureItem, getSecureItem, setSecureItem } from "../secure-storage"

jest.mock("expo-secure-store", () => ({
  isAvailableAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

const mockIsAvailable = SecureStore.isAvailableAsync as jest.Mock
const mockGet = SecureStore.getItemAsync as jest.Mock
const mockSet = SecureStore.setItemAsync as jest.Mock
const mockDelete = SecureStore.deleteItemAsync as jest.Mock

const realOS = Platform.OS

function setOS(os: string) {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true })
}

describe("secure storage", () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    jest.clearAllMocks()
    store.clear()
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: jest.fn((k: string) => store.get(k) ?? null),
        setItem: jest.fn((k: string, v: string) => void store.set(k, v)),
        removeItem: jest.fn((k: string) => void store.delete(k)),
      },
      configurable: true,
    })
  })

  afterEach(() => {
    setOS(realOS)
  })

  it("uses localStorage on web", async () => {
    setOS("web")
    await setSecureItem("k", "v")
    await expect(getSecureItem("k")).resolves.toBe("v")
    await deleteSecureItem("k")
    await expect(getSecureItem("k")).resolves.toBeNull()
    expect(mockIsAvailable).not.toHaveBeenCalled()
  })

  it("returns null on web when localStorage throws", async () => {
    setOS("web")
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: () => {
          throw new Error("denied")
        },
      },
      configurable: true,
    })
    await expect(getSecureItem("k")).resolves.toBeNull()
  })

  it("uses SecureStore on native", async () => {
    setOS("ios")
    mockIsAvailable.mockResolvedValue(true)
    mockGet.mockResolvedValue("secret")
    mockSet.mockResolvedValue(undefined)
    mockDelete.mockResolvedValue(undefined)
    await expect(getSecureItem("k")).resolves.toBe("secret")
    await setSecureItem("k", "v")
    expect(mockSet).toHaveBeenCalledWith("k", "v")
    await deleteSecureItem("k")
    expect(mockDelete).toHaveBeenCalledWith("k")
  })

  it("falls back to null when SecureStore is unavailable", async () => {
    setOS("ios")
    mockIsAvailable.mockRejectedValue(new Error("no"))
    await expect(getSecureItem("k")).resolves.toBe("secret".slice(0, 0) || null)
  })

  it("returns null when a native read fails", async () => {
    setOS("ios")
    mockIsAvailable.mockResolvedValue(true)
    mockGet.mockRejectedValue(new Error("locked"))
    await expect(getSecureItem("k")).resolves.toBeNull()
  })

  it("times out a hanging SecureStore call", async () => {
    setOS("ios")
    mockIsAvailable.mockReturnValue(new Promise(() => {}))
    await expect(getSecureItem("k")).resolves.toBeNull()
  }, 10000)
})
