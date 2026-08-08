import { getDatabase } from "@/db/database"
import * as secureStorage from "@/utils/secure-storage"
import {
  AI_PROVIDER_PRESETS,
  getAiProviderSettings,
  isAiProviderId,
  normalizeBaseUrl,
  saveAiApiKey,
} from "../ai-settings"

jest.mock("@/db/database", () => ({
  getDatabase: jest.fn(),
}))

jest.mock("@/utils/secure-storage", () => ({
  getSecureItem: jest.fn(),
  setSecureItem: jest.fn().mockResolvedValue(undefined),
  deleteSecureItem: jest.fn().mockResolvedValue(undefined),
}))

const mockGetSecureItem = secureStorage.getSecureItem as jest.MockedFunction<
  typeof secureStorage.getSecureItem
>
const mockSetSecureItem = secureStorage.setSecureItem as jest.MockedFunction<
  typeof secureStorage.setSecureItem
>
const mockDeleteSecureItem = secureStorage.deleteSecureItem as jest.MockedFunction<
  typeof secureStorage.deleteSecureItem
>

describe("ai-settings", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("defines presets for every provider with base URLs and models", () => {
    expect(AI_PROVIDER_PRESETS.openai.base_url).toBe("https://api.openai.com/v1")
    expect(AI_PROVIDER_PRESETS.openai.model).toBe("gpt-4o-mini")
    expect(AI_PROVIDER_PRESETS.openrouter.base_url).toBe("https://openrouter.ai/api/v1")
    expect(AI_PROVIDER_PRESETS.opencode.base_url).toBe("https://opencode.ai/zen/go/v1")
    expect(AI_PROVIDER_PRESETS.opencode.model).toBe("deepseek-v4-flash")
    expect(AI_PROVIDER_PRESETS.ollama.base_url).toBe("http://localhost:11434/v1")
    expect(AI_PROVIDER_PRESETS.ollama.model).toBe("llama3.2")
  })

  it("validates provider ids", () => {
    expect(isAiProviderId("opencode")).toBe(true)
    expect(isAiProviderId("banana")).toBe(false)
    expect(isAiProviderId(undefined)).toBe(false)
  })

  it("normalizes base URLs and falls back to the provider preset", () => {
    expect(normalizeBaseUrl("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1")
    expect(normalizeBaseUrl("https://ollama.local:11434/v1/")).toBe("https://ollama.local:11434/v1")
    expect(normalizeBaseUrl("  ", "opencode")).toBe("https://opencode.ai/zen/go/v1")
    expect(normalizeBaseUrl("  ")).toBe("https://api.openai.com/v1")
  })

  it("loads provider settings with secure-storage API key", async () => {
    const db = {
      getFirstAsync: jest.fn(async () => ({
        ai_enabled: 1,
        ai_provider: "openrouter",
        ai_base_url: "https://openrouter.ai/api/v1/",
        ai_model: "openai/gpt-4o-mini",
        ai_system_prompt: "Be brief",
      })),
    }
    ;(getDatabase as jest.Mock).mockResolvedValue(db)
    mockGetSecureItem.mockResolvedValue("sk-test")

    const settings = await getAiProviderSettings()
    expect(settings).toEqual({
      enabled: true,
      provider: "openrouter",
      base_url: "https://openrouter.ai/api/v1",
      api_key: "sk-test",
      model: "openai/gpt-4o-mini",
      system_prompt: "Be brief",
    })
  })

  it("falls back to the preset's model and base URL for blank rows", async () => {
    const db = {
      getFirstAsync: jest.fn(async () => ({
        ai_enabled: 0,
        ai_provider: "opencode",
        ai_base_url: "",
        ai_model: "",
        ai_system_prompt: "",
      })),
    }
    ;(getDatabase as jest.Mock).mockResolvedValue(db)
    mockGetSecureItem.mockResolvedValue(null)

    const settings = await getAiProviderSettings()
    expect(settings.provider).toBe("opencode")
    expect(settings.model).toBe("deepseek-v4-flash")
    expect(settings.base_url).toBe("https://opencode.ai/zen/go/v1")
    expect(settings.api_key).toBe("")
    expect(settings.enabled).toBe(false)
  })

  it("treats unknown providers as custom with openai defaults", async () => {
    const db = {
      getFirstAsync: jest.fn(async () => ({
        ai_enabled: 0,
        ai_provider: "mystery",
        ai_base_url: "",
        ai_model: "",
        ai_system_prompt: "",
      })),
    }
    ;(getDatabase as jest.Mock).mockResolvedValue(db)
    const settings = await getAiProviderSettings()
    expect(settings.provider).toBe("custom")
    expect(settings.model).toBe("gpt-4o-mini")
  })

  it("saveAiApiKey stores trimmed keys and clears empty ones", async () => {
    await saveAiApiKey("  sk-123  ")
    expect(mockSetSecureItem).toHaveBeenCalledWith("ai_api_key", "sk-123")

    await saveAiApiKey("   ")
    expect(mockDeleteSecureItem).toHaveBeenCalledWith("ai_api_key")
  })
})
