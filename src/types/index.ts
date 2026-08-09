export type MealType = "breakfast" | "lunch" | "dinner" | "snack"

export interface DiaryEntry {
  id: string
  date: string
  meal_type: MealType
  food_id: string | null
  food_name: string
  amount: number
  unit: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  created_at: string
  yazio_synced: number
  yazio_item_id: string | null
}

export interface CachedFood {
  yazio_product_id: string
  barcode: string | null
  name: string
  producer: string | null
  nutrients_json: string
  serving_json: string
  base_unit: string
  cached_at: string
  is_favorite: number
  last_used_at: string | null
  /**
   * Where the row came from: 'search' (per-gram nutrients — stale by design,
   * never served cache-first) or 'detail' (normalized per 100 g/ml — safe to
   * serve locally). Null for rows written before this column existed.
   */
  source: string | null
}

/** Provider presets mirroring Physiquinator (base URL + default model per provider). */
export type AiProviderId = "openai" | "openrouter" | "opencode" | "ollama" | "custom"

export interface AppSettings {
  calorie_goal: number
  protein_goal: number
  carbs_goal: number
  fat_goal: number
  units: string
  yazio_sync_enabled: number
  /** YAZIO profile `food_database_country` — used for product search. */
  food_database_country: string
  /** Auto-check GitHub releases for a newer app version on startup. */
  update_check_enabled: number
  /** In-app AI assistant master switch. */
  ai_enabled: number
  /** Provider preset — fills base URL + default model (see src/db/ai-settings.ts). */
  ai_provider: AiProviderId
  /** OpenAI-compatible endpoint, e.g. https://api.openai.com/v1 (OpenAI, OpenRouter, Ollama...). */
  ai_base_url: string
  /** Model name, e.g. gpt-4o-mini. */
  ai_model: string
  /** Optional extra instructions appended to the assistant's system prompt. */
  ai_system_prompt: string
  /** Last-applied agent (MCP) change revision — web snapshot bridge only. */
  agent_bridge_rev: number
  /** Explicit app theme: follow the system, or force light/dark. */
  theme_preference: "system" | "light" | "dark"
}

export interface FoodNutrients {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface FoodServing {
  serving: string
  amount: number
  serving_quantity: number
}

export interface SearchFoodResult {
  product_id: string
  name: string
  producer: string
  nutrients: FoodNutrients
  serving: FoodServing
  /** All serving options from YAZIO product detail (when loaded). */
  servings?: FoodServing[]
  base_unit: string
  is_verified: boolean
}

/**
 * One food inside a saved meal. Nutrients/serving are snapshotted so meals
 * render and log correctly even when the product cache has been cleared.
 */
export interface MealItem {
  product_id: string
  name: string
  producer: string
  amount: number
  base_unit: string
  nutrients: FoodNutrients
  serving: FoodServing
}

/** A user-created meal: foods you often eat together. */
export interface Meal {
  id: string
  name: string
  created_at: string
  updated_at: string
  last_used_at: string | null
  items: MealItem[]
}

// ── AI assistant ────────────────────────────────────────────────────────────

export type AiMessageRole = "system" | "user" | "assistant" | "tool"

export interface AiToolCallInfo {
  id: string
  name: string
  arguments_json: string
}

export interface AiChatMessage {
  id?: number
  role: AiMessageRole
  content: string
  reasoning?: string
  tool_calls?: AiToolCallInfo[]
  /** Set on tool messages — the id of the assistant tool call this answers. */
  tool_call_id?: string
  tool_name?: string
  is_error?: number
  created_at: string
}

/** A fragment of the streamed assistant response. */
export interface StreamingChunk {
  delta?: string
  reasoning?: string
  tool_calls?: AiToolCallInfo[]
  /** Non-null when the stream ended with an error (content carries the message). */
  error?: string
}

/** JSON Schema fragment describing one tool's parameters. */
export interface AiToolSchema {
  type: "object"
  properties: Record<string, unknown>
  required?: string[]
}

export interface AiProviderSettings {
  enabled: boolean
  provider: AiProviderId
  base_url: string
  api_key: string
  model: string
  system_prompt: string
}
