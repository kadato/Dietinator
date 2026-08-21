import type { AiProviderId, AiProviderSettings } from "@/types"
import { getDatabase } from "./database"
import { deleteSecureItem, getSecureItem, setSecureItem } from "@/utils/secure-storage"

const API_KEY_KEY = "ai_api_key"

/**
 * Provider presets mirroring Physiquinator: picking a preset fills the base
 * URL and a sensible default model. `custom` keeps whatever the user typed.
 */
export const AI_PROVIDER_PRESETS: Record<
  AiProviderId,
  { label: string; base_url: string; model: string }
> = {
  openai: {
    label: "OpenAI (Official)",
    base_url: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  openrouter: {
    label: "OpenRouter (Claude, Llama, DeepSeek)",
    base_url: "https://openrouter.ai/api/v1",
    model: "anthropic/claude-3.5-sonnet",
  },
  opencode: {
    label: "OpenCode",
    base_url: "https://opencode.ai/zen/go/v1",
    model: "deepseek-v4-flash",
  },
  ollama: {
    label: "Ollama / Local",
    base_url: "http://localhost:11434/v1",
    model: "llama3.2",
  },
  custom: {
    label: "Custom OpenAI-Compatible API",
    base_url: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
}

export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDER_PRESETS) as AiProviderId[]

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === "string" && value in AI_PROVIDER_PRESETS
}

/**
 * URL-normalized base endpoint, which keeps callers free of trailing-slash bugs.
 * OpenCode's gateway accepts the full URL (already ending in /chat/completions),
 * which the client detects when composing requests.
 */
export function normalizeBaseUrl(raw: string, provider: AiProviderId = "custom"): string {
  const trimmed = raw.trim()
  const fallback = AI_PROVIDER_PRESETS[provider]?.base_url ?? AI_PROVIDER_PRESETS.custom.base_url
  if (!trimmed) return fallback
  return trimmed.replace(/\/+$/, "")
}

export function presetFor(provider: AiProviderId) {
  return AI_PROVIDER_PRESETS[provider] ?? AI_PROVIDER_PRESETS.custom
}

export async function getAiProviderSettings(): Promise<AiProviderSettings> {
  const db = await getDatabase()
  const row = await db.getFirstAsync<{
    ai_enabled: number
    ai_provider: string
    ai_base_url: string
    ai_model: string
    ai_system_prompt: string
  }>(
    "SELECT ai_enabled, ai_provider, ai_base_url, ai_model, ai_system_prompt FROM settings WHERE id = 1",
  )
  const apiKey = (await getSecureItem(API_KEY_KEY)) ?? ""
  const provider = isAiProviderId(row?.ai_provider) ? row.ai_provider : "custom"
  const preset = presetFor(provider)
  return {
    enabled: row?.ai_enabled === 1,
    provider,
    base_url: normalizeBaseUrl(row?.ai_base_url ?? "", provider),
    api_key: apiKey,
    model: row?.ai_model?.trim() || preset.model,
    system_prompt: row?.ai_system_prompt ?? "",
  }
}

export async function saveAiApiKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim()
  if (trimmed) {
    await setSecureItem(API_KEY_KEY, trimmed)
  } else {
    await deleteSecureItem(API_KEY_KEY)
  }
}
