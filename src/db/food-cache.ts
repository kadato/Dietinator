import type { CachedFood, FoodNutrients, FoodServing, SearchFoodResult } from '@/types';
import { getDatabase } from './database';

function rowToCached(row: Record<string, unknown>): CachedFood {
  return {
    yazio_product_id: String(row.yazio_product_id),
    barcode: row.barcode ? String(row.barcode) : null,
    name: String(row.name),
    producer: row.producer ? String(row.producer) : null,
    nutrients_json: String(row.nutrients_json),
    serving_json: String(row.serving_json),
    cached_at: String(row.cached_at),
    is_favorite: Number(row.is_favorite),
    last_used_at: row.last_used_at ? String(row.last_used_at) : null,
  };
}

export function cachedToSearchResult(cached: CachedFood): SearchFoodResult {
  const nutrients = JSON.parse(cached.nutrients_json) as FoodNutrients;
  const serving = JSON.parse(cached.serving_json) as FoodServing;
  return {
    product_id: cached.yazio_product_id,
    name: cached.name,
    producer: cached.producer ?? '',
    nutrients,
    serving,
    base_unit: 'g',
    is_verified: true,
  };
}

export async function getFoodByBarcode(
  barcode: string,
): Promise<SearchFoodResult | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM food_cache WHERE barcode = ?',
    barcode,
  );
  return row ? cachedToSearchResult(rowToCached(row)) : null;
}

export async function getFoodById(
  productId: string,
): Promise<SearchFoodResult | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM food_cache WHERE yazio_product_id = ?',
    productId,
  );
  return row ? cachedToSearchResult(rowToCached(row)) : null;
}

export async function searchLocalFoods(query: string): Promise<SearchFoodResult[]> {
  const db = await getDatabase();
  const pattern = `%${query.trim()}%`;
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM food_cache
     WHERE name LIKE ? OR producer LIKE ? OR barcode LIKE ?
     ORDER BY last_used_at DESC NULLS LAST
     LIMIT 20`,
    pattern,
    pattern,
    pattern,
  );
  return rows.map((r) => cachedToSearchResult(rowToCached(r)));
}

export async function getRecentFoods(limit = 10): Promise<SearchFoodResult[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM food_cache
     WHERE last_used_at IS NOT NULL
     ORDER BY last_used_at DESC
     LIMIT ?`,
    limit,
  );
  return rows.map((r) => cachedToSearchResult(rowToCached(r)));
}

export async function getFavoriteFoods(): Promise<SearchFoodResult[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM food_cache WHERE is_favorite = 1 ORDER BY name ASC',
  );
  return rows.map((r) => cachedToSearchResult(rowToCached(r)));
}

export async function saveFoodToCache(
  food: SearchFoodResult,
  barcode: string | null = null,
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO food_cache (
      yazio_product_id, barcode, name, producer, nutrients_json, serving_json,
      cached_at, is_favorite, last_used_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT is_favorite FROM food_cache WHERE yazio_product_id = ?), 0), ?)
    ON CONFLICT(yazio_product_id) DO UPDATE SET
      barcode = COALESCE(excluded.barcode, food_cache.barcode),
      name = excluded.name,
      producer = excluded.producer,
      nutrients_json = excluded.nutrients_json,
      serving_json = excluded.serving_json,
      cached_at = excluded.cached_at,
      last_used_at = excluded.last_used_at`,
    food.product_id,
    barcode,
    food.name,
    food.producer,
    JSON.stringify(food.nutrients),
    JSON.stringify(food.serving),
    now,
    food.product_id,
    now,
  );
}

export async function touchFoodUsed(productId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE food_cache SET last_used_at = ? WHERE yazio_product_id = ?',
    new Date().toISOString(),
    productId,
  );
}

export async function toggleFavorite(productId: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ is_favorite: number }>(
    'SELECT is_favorite FROM food_cache WHERE yazio_product_id = ?',
    productId,
  );
  const next = row?.is_favorite ? 0 : 1;
  await db.runAsync(
    'UPDATE food_cache SET is_favorite = ? WHERE yazio_product_id = ?',
    next,
    productId,
  );
  return next === 1;
}

export async function clearFoodCache(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM food_cache');
}
