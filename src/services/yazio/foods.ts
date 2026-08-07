import type { MealType, SearchFoodResult } from '@/types';
import { isPerGramNutrients, isPerGramRawNutrients, nutrientsFromYazio } from '@/utils/nutrients';
import { withRetry } from '@/utils/retry';
import { pickBestBarcodeMatch } from '@/utils/barcode';
import * as foodCacheDb from '@/db/food-cache';
import {
  getYazioClient,
  getYazioEnergyUnit,
  getYazioProductSearchOptions,
  initYazioClient,
} from './client';

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

function withoutLegacyPerGramCache(
  cached: SearchFoodResult | null,
): SearchFoodResult | null {
  if (
    cached &&
    isPerGramNutrients(
      cached.nutrients,
      cached.base_unit || 'g',
      cached.serving.serving_quantity,
    )
  ) {
    return null;
  }
  return cached;
}

/** Products YAZIO suggests for a meal slot on a date (resolution falls back to cache/remote). */
export async function getSuggestedFoods(
  date: string,
  mealType: MealType,
  limit = 5,
): Promise<SearchFoodResult[]> {
  const yazio = await ensureClient();
  let suggested: { product_id: string }[];
  try {
    suggested = await withRetry(() =>
      yazio.user.getSuggestedProducts({ date, daytime: mealType }),
    );
  } catch {
    return [];
  }
  const ids = suggested.map((s) => s.product_id).slice(0, limit);
  if (ids.length === 0) return [];

  const cached = await foodCacheDb.getFoodsByIds(ids);
  const resolved: SearchFoodResult[] = [];
  for (const id of ids) {
    const fromCache = cached.get(id);
    if (fromCache) {
      resolved.push(fromCache);
    } else {
      const remote = await getFoodRemote(id);
      if (remote) resolved.push(remote);
    }
  }
  return resolved;
}

export async function searchFoodsRemote(
  query: string,
  unitEnergy?: string,
): Promise<SearchFoodResult[]> {
  const yazio = await ensureClient();
  const [energyUnit, searchOptions] = await Promise.all([
    unitEnergy ? Promise.resolve(unitEnergy) : getYazioEnergyUnit(),
    getYazioProductSearchOptions(),
  ]);
  const results = await withRetry(() =>
    yazio.products.search({
      query: query.trim(),
      countries: searchOptions.countries,
      sex: searchOptions.sex,
    }),
  );
  const mapped = results.map((r) => mapSearchResult(r, energyUnit));
  for (const food of mapped) {
    await foodCacheDb.saveFoodToCache(food);
  }
  return mapped;
}

export async function getFoodRemote(
  productId: string,
  unitEnergy?: string,
): Promise<SearchFoodResult | null> {
  const cached = await foodCacheDb.getFoodById(productId);

  let yazio;
  try {
    yazio = await ensureClient();
  } catch {
    return withoutLegacyPerGramCache(cached);
  }

  let product;
  try {
    product = await withRetry(() => yazio.products.get(productId));
  } catch {
    return withoutLegacyPerGramCache(cached);
  }
  if (!product) return withoutLegacyPerGramCache(cached);

  const energyUnit = unitEnergy ?? (await getYazioEnergyUnit());
  const defaultServing = product.servings[0];
  const defaultAmount = defaultServing?.amount ?? 100;
  const baseUnit = product.base_unit || 'g';
  // Product detail API returns nutrients per gram; normalize to per 100 g before rounding.
  const perGram = isPerGramRawNutrients(
    product.nutrients,
    baseUnit,
    energyUnit,
  );
  const mappedNutrients = nutrientsFromYazio(
    product.nutrients,
    energyUnit,
    perGram ? 100 : 1,
  );
  const food: SearchFoodResult = {
    product_id: product.id,
    name: product.name,
    producer: product.producer ?? '',
    nutrients: mappedNutrients,
    serving: perGram
      ? { serving: baseUnit, amount: 100, serving_quantity: 100 }
      : defaultServing
        ? {
            serving: defaultServing.serving,
            amount: defaultAmount,
            serving_quantity: defaultAmount,
          }
        : { serving: 'portion', amount: 100, serving_quantity: 100 },
    servings: product.servings.map((s) => ({
      serving: s.serving,
      amount: s.amount,
      serving_quantity: s.amount,
    })),
    base_unit: product.base_unit,
    is_verified: product.is_verified,
  };

  const barcode = product.eans?.[0] ?? null;
  await foodCacheDb.saveFoodToCache(food, barcode);
  return food;
}

export async function getFoodByBarcode(
  barcode: string,
  unitEnergy?: string,
): Promise<SearchFoodResult | null> {
  const cached = await foodCacheDb.getFoodByBarcode(barcode);
  if (cached) return cached;

  const results = await searchFoodsRemote(barcode, unitEnergy);
  return pickBestBarcodeMatch(results, barcode);
}

export async function searchFoods(
  query: string,
  unitEnergy?: string,
): Promise<{
  local: SearchFoodResult[];
  remote: SearchFoodResult[];
  /** True when the remote search failed (YAZIO unreachable), not just empty. */
  offline: boolean;
}> {
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
    return { local, remote: [], offline: false };
  }

  const local = await foodCacheDb.searchLocalFoods(trimmed);
  try {
    const remote = await searchFoodsRemote(trimmed, unitEnergy);
    return { local, remote, offline: false };
  } catch {
    return { local, remote: [], offline: true };
  }
}
