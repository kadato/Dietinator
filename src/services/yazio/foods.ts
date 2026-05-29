import type { SearchFoodResult } from '@/types';
import { nutrientsFromYazio } from '@/utils/nutrients';
import { withRetry } from '@/utils/retry';
import { pickBestBarcodeMatch } from '@/utils/barcode';
import * as foodCacheDb from '@/db/food-cache';
import { getYazioClient, initYazioClient } from './client';

function mapSearchResult(
  item: {
    product_id: string;
    name: string;
    producer: string;
    nutrients: Record<string, number>;
    serving: string;
    amount: number;
    serving_quantity: number;
    base_unit: string;
    is_verified: boolean;
  },
  unitEnergy = 'kcal',
): SearchFoodResult {
  return {
    product_id: item.product_id,
    name: item.name,
    producer: item.producer ?? '',
    nutrients: nutrientsFromYazio(item.nutrients, unitEnergy),
    serving: {
      serving: item.serving,
      amount: item.amount,
      serving_quantity: item.serving_quantity,
    },
    base_unit: item.base_unit,
    is_verified: item.is_verified,
  };
}

async function ensureClient() {
  let yazio = getYazioClient();
  if (!yazio) yazio = await initYazioClient();
  if (!yazio) throw new Error('Not logged in to YAZIO');
  return yazio;
}

export async function searchFoodsRemote(
  query: string,
  unitEnergy = 'kcal',
): Promise<SearchFoodResult[]> {
  const yazio = await ensureClient();
  const results = await withRetry(() =>
    yazio.products.search({ query: query.trim() }),
  );
  const mapped = results.map((r) => mapSearchResult(r, unitEnergy));
  for (const food of mapped) {
    await foodCacheDb.saveFoodToCache(food);
  }
  return mapped;
}

export async function getFoodRemote(
  productId: string,
  unitEnergy = 'kcal',
): Promise<SearchFoodResult | null> {
  const cached = await foodCacheDb.getFoodById(productId);
  if (cached) return cached;

  const yazio = await ensureClient();
  const product = await withRetry(() => yazio.products.get(productId));
  if (!product) return null;

  const serving = product.servings[0];
  const food: SearchFoodResult = {
    product_id: product.id,
    name: product.name,
    producer: product.producer ?? '',
    nutrients: nutrientsFromYazio(product.nutrients, unitEnergy),
    serving: serving
      ? {
          serving: serving.serving,
          amount: serving.amount,
          serving_quantity: serving.amount,
        }
      : { serving: 'portion', amount: 100, serving_quantity: 100 },
    base_unit: product.base_unit,
    is_verified: product.is_verified,
  };

  const barcode = product.eans?.[0] ?? null;
  await foodCacheDb.saveFoodToCache(food, barcode);
  return food;
}

export async function getFoodByBarcode(
  barcode: string,
  unitEnergy = 'kcal',
): Promise<SearchFoodResult | null> {
  const cached = await foodCacheDb.getFoodByBarcode(barcode);
  if (cached) return cached;

  const results = await searchFoodsRemote(barcode, unitEnergy);
  return pickBestBarcodeMatch(results, barcode);
}

export async function searchFoods(
  query: string,
  unitEnergy = 'kcal',
): Promise<{ local: SearchFoodResult[]; remote: SearchFoodResult[] }> {
  const trimmed = query.trim();
  if (!trimmed) {
    const [recent, favorites] = await Promise.all([
      foodCacheDb.getRecentFoods(),
      foodCacheDb.getFavoriteFoods(),
    ]);
    const seen = new Set<string>();
    const local: SearchFoodResult[] = [];
    for (const item of [...favorites, ...recent]) {
      if (!seen.has(item.product_id)) {
        seen.add(item.product_id);
        local.push(item);
      }
    }
    return { local, remote: [] };
  }

  const local = await foodCacheDb.searchLocalFoods(trimmed);
  try {
    const remote = await searchFoodsRemote(trimmed, unitEnergy);
    return { local, remote };
  } catch {
    return { local, remote: [] };
  }
}
