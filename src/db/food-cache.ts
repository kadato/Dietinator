import type {
  CachedFood,
  FoodNutrients,
  FoodServing,
  RecentFoodUsage,
  SearchFoodResult,
} from "@/types"
import { getDatabase } from "./database"
import { parseJson } from "@/utils/json"
import { isPerGramNutrients } from "@/utils/nutrients"

function rowToCached(row: Record<string, unknown>): CachedFood {
  return {
    yazio_product_id: String(row.yazio_product_id),
    barcode: row.barcode ? String(row.barcode) : null,
    name: String(row.name),
    producer: row.producer ? String(row.producer) : null,
    nutrients_json: String(row.nutrients_json),
    serving_json: String(row.serving_json),
    base_unit: row.base_unit ? String(row.base_unit) : "g",
    cached_at: String(row.cached_at),
    is_favorite: Number(row.is_favorite),
    favorite_order: row.favorite_order != null ? Number(row.favorite_order) : 0,
    last_used_at: row.last_used_at ? String(row.last_used_at) : null,
    last_amount: row.last_amount != null ? Number(row.last_amount) : null,
    servings_json: row.servings_json ? String(row.servings_json) : null,
    source: row.source ? String(row.source) : null,
  }
}

export function cachedToSearchResult(cached: CachedFood): SearchFoodResult | null {
  const nutrients = parseJson<FoodNutrients>(cached.nutrients_json)
  const serving = parseJson<FoodServing>(cached.serving_json)
  if (!nutrients || !serving || !serving.serving) return null
  const servings = cached.servings_json ? parseJson<FoodServing[]>(cached.servings_json) : undefined
  return {
    product_id: cached.yazio_product_id,
    name: cached.name,
    producer: cached.producer ?? "",
    nutrients,
    serving,
    servings: servings && servings.length > 0 ? servings : undefined,
    base_unit: cached.base_unit || "g",
    is_verified: true,
    last_amount:
      cached.last_amount != null && cached.last_amount > 0 ? cached.last_amount : undefined,
  }
}

function mapRows(rows: Record<string, unknown>[]): SearchFoodResult[] {
  const results: SearchFoodResult[] = []
  for (const row of rows) {
    const food = cachedToSearchResult(rowToCached(row))
    if (food) results.push(food)
  }
  return results
}

/** Escape `%` / `_` so user input acts as literal text, not LIKE wildcards. */
function escapeLike(query: string): string {
  return query.replace(/[\\%_]/g, (char) => `\\${char}`)
}

export async function getFoodByBarcode(barcode: string): Promise<SearchFoodResult | null> {
  const db = await getDatabase()
  const row = await db.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM food_cache WHERE barcode = ?",
    barcode,
  )
  return row ? cachedToSearchResult(rowToCached(row)) : null
}

export async function updateFoodBarcode(productId: string, barcode: string): Promise<void> {
  const db = await getDatabase()
  await db.runAsync(
    "UPDATE food_cache SET barcode = ? WHERE yazio_product_id = ?",
    barcode,
    productId,
  )
}

export async function getFoodById(productId: string): Promise<SearchFoodResult | null> {
  const db = await getDatabase()
  const row = await db.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM food_cache WHERE yazio_product_id = ?",
    productId,
  )
  return row ? cachedToSearchResult(rowToCached(row)) : null
}

/** Cache row including its source marker ('search' | 'detail' | null). */
export async function getCachedFoodById(productId: string): Promise<CachedFood | null> {
  const db = await getDatabase()
  const row = await db.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM food_cache WHERE yazio_product_id = ?",
    productId,
  )
  return row ? rowToCached(row) : null
}

/** Batch cache lookup — avoids N+1 reads when resolving a list of entries. */
export async function getFoodsByIds(productIds: string[]): Promise<Map<string, SearchFoodResult>> {
  const unique = [...new Set(productIds.filter(Boolean))]
  const map = new Map<string, SearchFoodResult>()
  if (unique.length === 0) return map
  const db = await getDatabase()
  const placeholders = unique.map(() => "?").join(", ")
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM food_cache WHERE yazio_product_id IN (${placeholders})`,
    ...unique,
  )
  for (const row of rows) {
    const food = cachedToSearchResult(rowToCached(row))
    if (food) map.set(food.product_id, food)
  }
  return map
}

export async function searchLocalFoods(query: string): Promise<SearchFoodResult[]> {
  const db = await getDatabase()
  const pattern = `%${escapeLike(query.trim())}%`
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM food_cache
     WHERE name LIKE ? ESCAPE '\\' OR producer LIKE ? ESCAPE '\\' OR barcode LIKE ? ESCAPE '\\'
     ORDER BY last_used_at DESC NULLS LAST
     LIMIT 50`,
    pattern,
    pattern,
    pattern,
  )
  return mapRows(rows)
}

export async function getRecentFoods(limit = 10): Promise<SearchFoodResult[]> {
  const db = await getDatabase()
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM food_cache
     WHERE last_used_at IS NOT NULL
     ORDER BY last_used_at DESC
     LIMIT ?`,
    limit,
  )
  return mapRows(rows)
}

/**
 * Recent usage rows for the recents list: one entry per distinct
 * (food, amount) pair ever logged, newest log first. The same food shows up
 * multiple times — once per past amount — so repeat logging is one tap away.
 * Pairs whose food is no longer cached are skipped.
 */
export async function getRecentFoodUsages(limit = 20): Promise<RecentFoodUsage[]> {
  const db = await getDatabase()
  const rows = await db.getAllAsync<{ food_id: string; amount: number; last_logged: string }>(
    `SELECT d.food_id, d.amount, MAX(d.created_at) AS last_logged
     FROM diary_entries d
     WHERE d.food_id IS NOT NULL
     GROUP BY d.food_id, d.amount
     ORDER BY last_logged DESC
     LIMIT ?`,
    limit,
  )
  if (rows.length === 0) return []

  const foods = await getFoodsByIds(rows.map((row) => row.food_id))
  const usages: RecentFoodUsage[] = []
  for (const row of rows) {
    const food = foods.get(row.food_id)
    if (food)
      usages.push({ food, amount: Number(row.amount) || 0, lastLoggedAt: String(row.last_logged) })
  }
  return usages
}

export async function getFavoriteFoods(): Promise<SearchFoodResult[]> {
  const db = await getDatabase()
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM food_cache WHERE is_favorite = 1 ORDER BY favorite_order ASC, name ASC LIMIT 100",
  )
  return mapRows(rows)
}

/**
 * Upsert a food into the cache.
 *
 * `preserveLastUsedAt` keeps recent-usage markers untouched: fresh rows are
 * stored with no usage date and existing rows keep theirs. Use it for silent
 * cache warm-ups (e.g. saving a meal) where the food was not consumed.
 *
 * `source` records whether the row holds per-gram search data ('search') or
 * normalized product details ('detail'). When omitted it is inferred from the
 * nutrient values, so silent warm-ups still tag rows correctly.
 */
export async function saveFoodToCache(
  food: SearchFoodResult,
  barcode: string | null = null,
  preserveLastUsedAt = false,
  source?: "search" | "detail",
): Promise<void> {
  const db = await getDatabase()
  const now = new Date().toISOString()
  const rowSource =
    source ??
    (isPerGramNutrients(food.nutrients, food.base_unit || "g", food.serving.serving_quantity)
      ? "search"
      : "detail")
  await db.runAsync(
    `INSERT INTO food_cache (
      yazio_product_id, barcode, name, producer, nutrients_json, serving_json, servings_json,
      base_unit, cached_at, is_favorite, last_used_at, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT is_favorite FROM food_cache WHERE yazio_product_id = ?), 0), ?, ?)
    ON CONFLICT(yazio_product_id) DO UPDATE SET
      barcode = COALESCE(excluded.barcode, food_cache.barcode),
      name = excluded.name,
      producer = excluded.producer,
      nutrients_json = excluded.nutrients_json,
      serving_json = excluded.serving_json,
      servings_json = excluded.servings_json,
      base_unit = excluded.base_unit,
      cached_at = excluded.cached_at,
      last_used_at = ${preserveLastUsedAt ? "food_cache.last_used_at" : "excluded.last_used_at"},
      source = excluded.source`,
    food.product_id,
    barcode,
    food.name,
    food.producer,
    JSON.stringify(food.nutrients),
    JSON.stringify(food.serving),
    food.servings?.length ? JSON.stringify(food.servings) : null,
    food.base_unit || "g",
    now,
    food.product_id,
    preserveLastUsedAt ? null : now,
    rowSource,
  )
}

/**
 * Warm the cache from a search response. Search rows hold per-gram nutrients
 * and would otherwise clobber the normalized 'detail' row a user already
 * opened — which forces a redundant refetch on the next visit. Search only
 * fills gaps: existing 'detail' rows are left untouched.
 */
export async function saveSearchResultToCache(food: SearchFoodResult): Promise<void> {
  const db = await getDatabase()
  const now = new Date().toISOString()
  await db.runAsync(
    `INSERT INTO food_cache (
      yazio_product_id, barcode, name, producer, nutrients_json, serving_json, servings_json,
      base_unit, cached_at, is_favorite, last_used_at, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT is_favorite FROM food_cache WHERE yazio_product_id = ?), 0), ?, 'search')
    ON CONFLICT(yazio_product_id) DO UPDATE SET
      barcode = COALESCE(excluded.barcode, food_cache.barcode),
      name = excluded.name,
      producer = excluded.producer,
      nutrients_json = excluded.nutrients_json,
      serving_json = excluded.serving_json,
      base_unit = excluded.base_unit,
      cached_at = excluded.cached_at,
      last_used_at = food_cache.last_used_at,
      source = 'search'
    WHERE food_cache.source IS NOT 'detail'`,
    food.product_id,
    null,
    food.name,
    food.producer,
    JSON.stringify(food.nutrients),
    JSON.stringify(food.serving),
    null,
    food.base_unit || "g",
    now,
    food.product_id,
    null,
  )
}

/**
 * Mark a food as recently consumed. When `amount` (base units) is given it is
 * remembered as the portion used the last time — the add-food screen prefills
 * it so repeat logging keeps the previous amount.
 */
export async function touchFoodUsed(productId: string, amount?: number): Promise<void> {
  const db = await getDatabase()
  await db.runAsync(
    "UPDATE food_cache SET last_used_at = ?, last_amount = COALESCE(?, last_amount) WHERE yazio_product_id = ?",
    new Date().toISOString(),
    typeof amount === "number" && Number.isFinite(amount) && amount > 0 ? amount : null,
    productId,
  )
}

export async function getIsFavorite(productId: string): Promise<boolean> {
  const db = await getDatabase()
  const row = await db.getFirstAsync<{ is_favorite: number }>(
    "SELECT is_favorite FROM food_cache WHERE yazio_product_id = ?",
    productId,
  )
  return row?.is_favorite === 1
}

/**
 * Flip a food's favorite flag. When the food is not cached yet (e.g. a fresh
 * search result) it is upserted first so the star change actually sticks.
 * Returns the new favorite state.
 */
export async function toggleFavorite(productId: string, food?: SearchFoodResult): Promise<boolean> {
  const db = await getDatabase()
  const row = await db.getFirstAsync<{ is_favorite: number }>(
    "SELECT is_favorite FROM food_cache WHERE yazio_product_id = ?",
    productId,
  )
  if (!row && food) {
    await saveFoodToCache(food, null, true)
  }
  const current = row?.is_favorite ?? 0
  const next = current ? 0 : 1
  if (next === 1) {
    const maxRow = await db.getFirstAsync<{ max_order: number | null }>(
      "SELECT MAX(favorite_order) AS max_order FROM food_cache WHERE is_favorite = 1",
    )
    const nextOrder = (maxRow?.max_order ?? -1) + 1
    await db.runAsync(
      "UPDATE food_cache SET is_favorite = 1, favorite_order = ? WHERE yazio_product_id = ?",
      nextOrder,
      productId,
    )
  } else {
    await db.runAsync("UPDATE food_cache SET is_favorite = 0 WHERE yazio_product_id = ?", productId)
  }
  return next === 1
}

/**
 * Persist custom favorite items order in SQLite.
 */
export async function updateFavoriteOrder(orderedProductIds: string[]): Promise<void> {
  const db = await getDatabase()
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedProductIds.length; i++) {
      await db.runAsync(
        "UPDATE food_cache SET favorite_order = ? WHERE yazio_product_id = ?",
        i,
        orderedProductIds[i],
      )
    }
  })
}

export async function clearFoodCache(): Promise<void> {
  const db = await getDatabase()
  await db.runAsync("DELETE FROM food_cache")
}
