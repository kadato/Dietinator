import type { SearchFoodResult } from "@/types"

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
