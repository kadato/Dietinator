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
  favorite_order?: number
  last_used_at: string | null
  /** Base-unit amount logged the last time this food was consumed. */
  last_amount: number | null
  /**
   * JSON array of all YAZIO serving options, such as cup, each, serving, and whole.
   * Null for rows cached before this column existed or from search results.
   */
  servings_json: string | null
  /**
   * Where the row came from. Search means per-gram nutrients, stale by design
   * and never served cache-first. Detail means normalized per 100 g per ml, safe to
   * serve locally. Null for rows written before this column existed.
   */
  source: string | null
}

/** Provider presets mirroring Physiquinator. Base URL and default model per provider. */
export type AiProviderId = "openai" | "openrouter" | "opencode" | "ollama" | "custom"

export interface AppSettings {
  calorie_goal: number
  protein_goal: number
  carbs_goal: number
  fat_goal: number
  units: string
  yazio_sync_enabled: number
  /** YAZIO profile `food_database_country`, used for product search. */
  food_database_country: string
  /** Auto-check GitHub releases for a newer app version on startup. */
  update_check_enabled: number
  /** In-app AI assistant master switch. */
  ai_enabled: number
  /** Provider preset. Fills base URL and default model. See src/db/ai-settings.ts. */
  ai_provider: AiProviderId
  /** OpenAI-compatible endpoint, for example https://api.openai.com/v1 for OpenAI, OpenRouter, Ollama, and others. */
  ai_base_url: string
  /** Model name, for example gpt-4o-mini. */
  ai_model: string
  /** Optional extra instructions appended to the assistant's system prompt. */
  ai_system_prompt: string
  /** Last-applied agent change revision. MCP. Web snapshot bridge only. */
  agent_bridge_rev: number
  /** Explicit app theme. Follow the system, or force light or dark. */
  theme_preference: "system" | "light" | "dark"
  /** Daily hydration target in milliliters. 0 is unset and falls back to YAZIO. */
  water_goal_ml: number
  /** Body height in centimeters. 0 is unset, so no BMI shown. */
  height_cm: number
  /** Goal bodyweight in kilograms. 0 is unset. */
  target_weight_kg: number
}

export interface FoodNutrients {
  kcal: number
  protein: number
  carbs: number
  fat: number
  /** Dietary fiber in grams */
  fiber?: number
  /** Total sugars in grams */
  sugar?: number
  /** Saturated fat in grams */
  saturated_fat?: number
  /** Unsaturated fat in grams */
  unsaturated_fat?: number
  /** Sodium in milligrams */
  sodium?: number
  /** Potassium in milligrams */
  potassium?: number
  /** Cholesterol in milligrams */
  cholesterol?: number
  /** Calcium in milligrams */
  calcium?: number
  /** Iron in milligrams */
  iron?: number
  /** Magnesium in milligrams */
  magnesium?: number
  /** Zinc in milligrams */
  zinc?: number
  /** Vitamin A in micrograms */
  vitamin_a?: number
  /** Vitamin C in milligrams */
  vitamin_c?: number
  /** Vitamin D in micrograms */
  vitamin_d?: number
  /** Vitamin B12 in micrograms */
  vitamin_b12?: number
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
  /** All serving options from YAZIO product detail, when loaded. */
  servings?: FoodServing[]
  base_unit: string
  is_verified: boolean
  /** Remembered amount logged the last time this food was consumed. */
  last_amount?: number
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

/**
 * One past food and amount log. The recents list renders these as separate
 * quick-add rows, so the same food can appear many times with the amounts
 * it was actually logged at.
 */
export interface RecentFoodUsage {
  food: SearchFoodResult
  /** Base-unit amount that was logged. */
  amount: number
  /** ISO timestamp of the most recent log of this food + amount pair. */
  lastLoggedAt: string
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

/** One logged bodyweight. At most one row per date. Upsert on save. */
export interface WeightEntry {
  id: string
  date: string
  /** Always stored in kilograms regardless of the display unit system. */
  weight_kg: number
  note: string | null
  created_at: string
}

/** One logged water pour. */
export interface WaterEntry {
  id: string
  date: string
  /** Always stored in milliliters regardless of the display unit system. */
  amount_ml: number
  created_at: string
}

// AI assistant

type AiMessageRole = "system" | "user" | "assistant" | "tool"

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
  /** Set on tool messages: the id of the assistant tool call this answers. */
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
  /** Non-null when the stream ended with an error. Content carries the message. */
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
