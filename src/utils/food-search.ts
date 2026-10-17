import type { RecentFoodUsage, SearchFoodResult } from "@/types"

/** Merge two food lists, dropping duplicates by product id. The first list wins. */
export function mergeFoodResults(
  local: SearchFoodResult[],
  remote: SearchFoodResult[],
): SearchFoodResult[] {
  const seen = new Set<string>()
  const merged: SearchFoodResult[] = []
  for (const item of [...local, ...remote]) {
    if (!seen.has(item.product_id)) {
      seen.add(item.product_id)
      merged.push(item)
    }
  }
  return merged
}

/** Filter food items by query matching name or producer. */
export function filterFoodsByQuery<T extends { name: string; producer?: string | null }>(
  items: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      Boolean(item.producer && item.producer.toLowerCase().includes(q)),
  )
}

/** Filter recent food usages by query matching food name or producer. */
export function filterRecentUsagesByQuery(
  usages: RecentFoodUsage[],
  query: string,
): RecentFoodUsage[] {
  const q = query.trim().toLowerCase()
  if (!q) return usages
  return usages.filter(
    (u) =>
      u.food.name.toLowerCase().includes(q) ||
      Boolean(u.food.producer && u.food.producer.toLowerCase().includes(q)),
  )
}
