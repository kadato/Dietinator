import type { SearchFoodResult } from "@/types"

let pending: SearchFoodResult | null = null

export function setPendingMealFood(food: SearchFoodResult): void {
  pending = food
}

export function consumePendingMealFood(): SearchFoodResult | null {
  const food = pending
  pending = null
  return food
}
