import type { RecentFoodUsage, SearchFoodResult } from "@/types"

/** Lowercases the value, strips diacritics, and collapses whitespace. For example, "Crème Brûlée" becomes "creme brulee". */
export function normalizeQueryText(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim()
}

/** Split a normalized query into non-empty tokens. */
export function queryTokens(query: string): string[] {
  const normalized = normalizeQueryText(query)
  if (!normalized) return []
  return normalized.split(" ")
}

/**
 * Returns true when every query token appears somewhere in the haystack.
 * Matching is order-independent, so "breast chicken" matches "Grilled Chicken Breast".
 */
export function matchesAllTokens(haystack: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const normalized = normalizeQueryText(haystack)
  return tokens.every((token) => normalized.includes(token))
}

/** Merges two food lists and drops duplicates by product id. The first list wins. */
export function mergeFoodResults(
  local: SearchFoodResult[],
  remote: SearchFoodResult[],
  query?: string,
): SearchFoodResult[] {
  const seen = new Set<string>()
  const merged: SearchFoodResult[] = []
  for (const item of [...local, ...remote]) {
    if (!seen.has(item.product_id)) {
      seen.add(item.product_id)
      merged.push(item)
    }
  }
  return query?.trim() ? rankFoodResults(merged, query) : merged
}

/**
 * Ranks foods for a query. Exact name match comes first, then name prefix,
 * then any substring. Verified foods rank before unverified foods within each tier.
 * Ties keep input order, so local-first still wins ties.
 */
export function rankFoodResults<T extends { name: string; is_verified?: boolean }>(
  items: T[],
  query: string,
): T[] {
  const normalized = normalizeQueryText(query)
  if (!normalized) return items
  const scored = items.map((item, index) => {
    const name = normalizeQueryText(item.name)
    let tier = 2
    if (name === normalized) tier = 0
    else if (name.startsWith(normalized)) tier = 1
    return { item, index, tier, verified: item.is_verified ? 0 : 1 }
  })
  scored.sort((a, b) => a.tier - b.tier || a.verified - b.verified || a.index - b.index)
  return scored.map((s) => s.item)
}

/** Filters food items by query matching name or producer. Every token must match, in any order. */
export function filterFoodsByQuery<T extends { name: string; producer?: string | null }>(
  items: T[],
  query: string,
): T[] {
  const tokens = queryTokens(query)
  if (tokens.length === 0) return items
  return items.filter((item) => matchesAllTokens(`${item.name} ${item.producer ?? ""}`, tokens))
}

/** Filters recent food usages by query matching food name or producer. Every token must match. */
export function filterRecentUsagesByQuery(
  usages: RecentFoodUsage[],
  query: string,
): RecentFoodUsage[] {
  const tokens = queryTokens(query)
  if (tokens.length === 0) return usages
  return usages.filter((u) => matchesAllTokens(`${u.food.name} ${u.food.producer ?? ""}`, tokens))
}
