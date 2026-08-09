import type { CachedFood, MealType, SearchFoodResult } from "@/types"
import { isPerGramNutrients, isPerGramRawNutrients, nutrientsFromYazio } from "@/utils/nutrients"
import { withRetry } from "@/utils/retry"
import { pickBestBarcodeMatch } from "@/utils/barcode"
import * as foodCacheDb from "@/db/food-cache"
import { ensureYazioClient, getYazioEnergyUnit, getYazioProductSearchOptions } from "./client"

function mapSearchResult(
  item: {
    product_id: string
    name: string
    producer: string
    nutrients: Record<string, number>
    serving: string
    amount: number
    serving_quantity: number
    base_unit: string
    is_verified: boolean
  },
  unitEnergy = "kcal",
): SearchFoodResult {
  return {
    product_id: item.product_id,
    name: item.name,
    producer: item.producer ?? "",
    nutrients: nutrientsFromYazio(item.nutrients, unitEnergy),
    serving: {
      serving: item.serving,
      amount: item.amount,
      serving_quantity: item.serving_quantity,
    },
    base_unit: item.base_unit,
    is_verified: item.is_verified,
  }
}

async function ensureClient() {
  const yazio = await ensureYazioClient()
  if (!yazio) throw new Error("Not logged in to YAZIO")
  return yazio
}

function withoutLegacyPerGramCache(cached: SearchFoodResult | null): SearchFoodResult | null {
  if (
    cached &&
    isPerGramNutrients(cached.nutrients, cached.base_unit || "g", cached.serving.serving_quantity)
  ) {
    return null
  }
  return cached
}

/**
 * True when a cache row can be served without touching the network.
 * - 'detail' rows: normalized per 100 g/ml — always safe.
 * - 'search' rows: per-gram by design — never served as normalized data.
 * - Legacy rows (no marker, written before this column existed): clearly
 *   normalized rows (kcal >= 10, or non-g/ml units) are safe; anything
 *   per-gram or ambiguous (low kcal in g/ml) must refetch once and gets
 *   re-tagged 'detail' by that fetch.
 */
function isUsableCacheRow(row: CachedFood, cached: SearchFoodResult | null): boolean {
  if (!cached) return false
  if (row.source === "detail") return true
  if (row.source === "search") return false
  const gml = cached.base_unit === "g" || cached.base_unit === "ml"
  return !gml || cached.nutrients.kcal >= 10
}

/**
 * Known foods (anything cached with normalized nutrients, e.g. everything the
 * user has ever searched or logged) are served from SQLite instantly. The
 * cache refreshes silently in the background, at most once per product per
 * window, so the UI never waits on the network for nutrition facts it has
 * already seen.
 */
const CACHE_REFRESH_TTL_MS = 12 * 60 * 60 * 1000
const inFlightRefreshes = new Map<string, Promise<void>>()
const lastRefreshAt = new Map<string, number>()

/** Fetch one product from YAZIO and warm the cache. Returns null on failure. */
async function fetchFoodDetail(
  productId: string,
  unitEnergy?: string,
): Promise<SearchFoodResult | null> {
  let yazio
  try {
    yazio = await ensureClient()
  } catch {
    return null
  }

  let product
  try {
    product = await withRetry(() => yazio.products.get(productId))
  } catch {
    return null
  }
  if (!product) return null

  const energyUnit = unitEnergy ?? (await getYazioEnergyUnit())
  const defaultServing = product.servings[0]
  const defaultAmount = defaultServing?.amount ?? 100
  const baseUnit = product.base_unit || "g"
  // Product detail API returns nutrients per gram; normalize to per 100 g before rounding.
  const perGram = isPerGramRawNutrients(product.nutrients, baseUnit, energyUnit)
  const mappedNutrients = nutrientsFromYazio(product.nutrients, energyUnit, perGram ? 100 : 1)
  const food: SearchFoodResult = {
    product_id: product.id,
    name: product.name,
    producer: product.producer ?? "",
    nutrients: mappedNutrients,
    serving: perGram
      ? { serving: baseUnit, amount: 100, serving_quantity: 100 }
      : defaultServing
        ? {
            serving: defaultServing.serving,
            amount: defaultAmount,
            serving_quantity: defaultAmount,
          }
        : { serving: "portion", amount: 100, serving_quantity: 100 },
    servings: product.servings.map((s) => ({
      serving: s.serving,
      amount: s.amount,
      serving_quantity: s.amount,
    })),
    base_unit: product.base_unit,
    is_verified: product.is_verified,
  }

  const barcode = product.eans?.[0] ?? null
  // Viewing a product is not consuming it — don't touch its "recently used" marker.
  await foodCacheDb.saveFoodToCache(food, barcode, true, "detail")
  return food
}

/** Fire-and-forget cache refresh: single-flight per product, throttled. */
function refreshFoodDetail(productId: string, unitEnergy?: string): void {
  const last = lastRefreshAt.get(productId) ?? 0
  if (Date.now() - last < CACHE_REFRESH_TTL_MS) return
  const inFlight = inFlightRefreshes.get(productId)
  if (inFlight) return

  const promise = fetchFoodDetail(productId, unitEnergy)
    .then((food) => {
      // Only advance the throttle on success so a flaky network retries soon.
      if (food) lastRefreshAt.set(productId, Date.now())
    })
    .catch(() => undefined)
    .finally(() => {
      inFlightRefreshes.delete(productId)
    })
  inFlightRefreshes.set(productId, promise)
}

export async function getFoodRemote(
  productId: string,
  unitEnergy?: string,
): Promise<SearchFoodResult | null> {
  const row = await foodCacheDb.getCachedFoodById(productId)
  const cached = row ? foodCacheDb.cachedToSearchResult(row) : null

  if (row && cached && isUsableCacheRow(row, cached)) {
    // Known food — serve the cache instantly and refresh in the background.
    refreshFoodDetail(productId, unitEnergy)
    return cached
  }

  const fresh = await fetchFoodDetail(productId, unitEnergy)
  return fresh ?? withoutLegacyPerGramCache(cached)
}

/** Products YAZIO suggests for a meal slot on a date (resolution falls back to cache/remote). */
export async function getSuggestedFoods(
  date: string,
  mealType: MealType,
  limit = 5,
): Promise<SearchFoodResult[]> {
  const yazio = await ensureClient()
  let suggested: { product_id: string }[]
  try {
    suggested = await withRetry(() => yazio.user.getSuggestedProducts({ date, daytime: mealType }))
  } catch {
    return []
  }
  const ids = suggested.map((s) => s.product_id).slice(0, limit)
  if (ids.length === 0) return []

  const cached = await foodCacheDb.getFoodsByIds(ids)
  const resolved: SearchFoodResult[] = []
  for (const id of ids) {
    const fromCache = cached.get(id)
    if (fromCache) {
      resolved.push(fromCache)
    } else {
      const remote = await getFoodRemote(id)
      if (remote) resolved.push(remote)
    }
  }
  return resolved
}

export async function searchFoodsRemote(
  query: string,
  unitEnergy?: string,
): Promise<SearchFoodResult[]> {
  const yazio = await ensureClient()
  const [energyUnit, searchOptions] = await Promise.all([
    unitEnergy ? Promise.resolve(unitEnergy) : getYazioEnergyUnit(),
    getYazioProductSearchOptions(),
  ])
  const results = await withRetry(() =>
    yazio.products.search({
      query: query.trim(),
      countries: searchOptions.countries,
      sex: searchOptions.sex,
    }),
  )
  const mapped = results.map((r) => mapSearchResult(r, energyUnit))
  // Cache writes run in parallel; a slow write must not stall the search UI.
  // Searching or browsing is not consuming: preserve last_used_at so the
  // "Recent" list only ever shows foods that were actually logged, and never
  // clobber a normalized 'detail' row the user has already opened — otherwise
  // the next visit to that food would refetch it from the network.
  await Promise.all(mapped.map((food) => foodCacheDb.saveSearchResultToCache(food)))
  return mapped
}

export async function getFoodByBarcode(
  barcode: string,
  unitEnergy?: string,
): Promise<SearchFoodResult | null> {
  const cached = await foodCacheDb.getFoodByBarcode(barcode)
  if (cached) return cached

  const results = await searchFoodsRemote(barcode, unitEnergy)
  return pickBestBarcodeMatch(results, barcode)
}
