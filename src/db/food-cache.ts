import type { CachedFood, FoodNutrients, FoodServing, SearchFoodResult } from "@/types"
import { getDatabase } from "./database"
import { parseJson } from "@/utils/json"

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
    last_used_at: row.last_used_at ? String(row.last_used_at) : null,
  }
}

export function cachedToSearchResult(cached: CachedFood): SearchFoodResult | null {
  const nutrients = parseJson<FoodNutrients>(cached.nutrients_json)
  const serving = parseJson<FoodServing>(cached.serving_json)
  if (!nutrients || !serving || !serving.serving) return null
  return {
    product_id: cached.yazio_product_id,
    name: cached.name,
    producer: cached.producer ?? "",
    nutrients,
    serving,
    base_unit: cached.base_unit || "g",
    is_verified: true,
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

export async function getFoodById(productId: string): Promise<SearchFoodResult | null> {
  const db = await getDatabase()
  const row = await db.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM food_cache WHERE yazio_product_id = ?",
    productId,
  )
  return row ? cachedToSearchResult(rowToCached(row)) : null
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

export async function getFavoriteFoods(): Promise<SearchFoodResult[]> {
  const db = await getDatabase()
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM food_cache WHERE is_favorite = 1 ORDER BY name ASC LIMIT 100",
  )
  return mapRows(rows)
}

/**
 * Upsert a food into the cache.
 *
 * `preserveLastUsedAt` keeps recent-usage markers untouched: fresh rows are
 * stored with no usage date and existing rows keep theirs. Use it for silent
 * cache warm-ups (e.g. saving a meal) where the food was not consumed.
 */
export async function saveFoodToCache(
  food: SearchFoodResult,
  barcode: string | null = null,
  preserveLastUsedAt = false,
): Promise<void> {
  const db = await getDatabase()
  const now = new Date().toISOString()
  await db.runAsync(
    `INSERT INTO food_cache (
      yazio_product_id, barcode, name, producer, nutrients_json, serving_json, base_unit,
      cached_at, is_favorite, last_used_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT is_favorite FROM food_cache WHERE yazio_product_id = ?), 0), ?)
    ON CONFLICT(yazio_product_id) DO UPDATE SET
      barcode = COALESCE(excluded.barcode, food_cache.barcode),
      name = excluded.name,
      producer = excluded.producer,
      nutrients_json = excluded.nutrients_json,
      serving_json = excluded.serving_json,
      base_unit = excluded.base_unit,
      cached_at = excluded.cached_at,
      last_used_at = ${preserveLastUsedAt ? "food_cache.last_used_at" : "excluded.last_used_at"}`,
    food.product_id,
    barcode,
    food.name,
    food.producer,
    JSON.stringify(food.nutrients),
    JSON.stringify(food.serving),
    food.base_unit || "g",
    now,
    food.product_id,
    preserveLastUsedAt ? null : now,
  )
}

export async function touchFoodUsed(productId: string): Promise<void> {
  const db = await getDatabase()
  await db.runAsync(
    "UPDATE food_cache SET last_used_at = ? WHERE yazio_product_id = ?",
    new Date().toISOString(),
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

export async function toggleFavorite(productId: string): Promise<boolean> {
  const db = await getDatabase()
  const row = await db.getFirstAsync<{ is_favorite: number }>(
    "SELECT is_favorite FROM food_cache WHERE yazio_product_id = ?",
    productId,
  )
  const next = row?.is_favorite ? 0 : 1
  await db.runAsync(
    "UPDATE food_cache SET is_favorite = ? WHERE yazio_product_id = ?",
    next,
    productId,
  )
  return next === 1
}

export async function clearFoodCache(): Promise<void> {
  const db = await getDatabase()
  await db.runAsync("DELETE FROM food_cache")
}
