import type { FoodServing, SearchFoodResult } from "@/types"
import { isPerGramNutrients, resolveNutrientsRefAmount } from "@/utils/nutrients"

export function formatServingOption(serving: FoodServing, baseUnit: string): string {
  const label = serving.serving || baseUnit
  if (label === "g" || label === "ml" || label === baseUnit) {
    return `${serving.amount} ${baseUnit}`
  }
  return `${label} (${serving.amount} ${baseUnit})`
}

export function formatNutrientsServingLabel(
  food: Pick<SearchFoodResult, "nutrients" | "serving" | "base_unit">,
  amount: number,
): string {
  const unit = food.base_unit || "g"
  const ref = resolveNutrientsRefAmount(food.nutrients, food.serving, unit)
  const amt = Number(amount) || 0
  if (amt <= 0) return `per ${ref} ${unit}`

  const name = food.serving.serving
  if (name && name !== "g" && name !== "ml" && name !== unit) {
    return `for ${amt} ${unit} · ${name}`
  }
  return `for ${amt} ${unit}`
}

export function formatListNutrientLine(food: SearchFoodResult): string {
  const unit = food.base_unit || "g"
  const perGram = isPerGramNutrients(food.nutrients, unit, food.serving.serving_quantity)
  if (perGram) {
    // Search rows carry per-gram values — show them as per-100 g for readability.
    const prefix = food.producer ? `${food.producer} · ` : ""
    return `${prefix}${Math.round(food.nutrients.kcal * 100)} kcal / 100 ${unit}`
  }
  const ref = resolveNutrientsRefAmount(food.nutrients, food.serving, unit)
  const prefix = food.producer ? `${food.producer} · ` : ""
  const servingLabel =
    ref === food.serving.amount
      ? `${ref}${unit}`
      : `${ref}${unit} (default ${food.serving.amount}${unit})`
  return `${prefix}${food.nutrients.kcal} kcal / ${servingLabel}`
}
