import type { FoodServing, SearchFoodResult } from "@/types"
import {
  isPerGramNutrients,
  nutrientsForAmount,
  resolveNutrientsRefAmount,
} from "@/utils/nutrients"
import { formatNumber } from "@/utils/format"

/** YAZIO serving keys are dotted ids ("whole.regular", "small.piece"); show readable labels. */
export function formatServingLabel(label: string): string {
  return label
    .split(".")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/** Human label for a YAZIO base unit (g/ml stay, countable units get English names). */
export function displayUnit(baseUnit: string): string {
  switch (baseUnit) {
    case "stück":
      return "each"
    case "portion":
      return "serving"
    default:
      return baseUnit || "g"
  }
}

export function formatServingOption(serving: FoodServing, baseUnit: string): string {
  const label = serving.serving || baseUnit
  const unit = displayUnit(baseUnit)
  const pretty = formatServingLabel(label)
  // Plain unit labels ("100 g", "250 ml") and countable labels that are just
  // the unit ("each" on a stück product) render without the redundant
  // parenthetical.
  if (
    label === "g" ||
    label === "ml" ||
    label === baseUnit ||
    label.endsWith(` ${baseUnit}`) ||
    pretty.toLowerCase() === unit
  ) {
    return `${formatNumber(serving.amount)} ${unit}`
  }
  return `${pretty} (${formatNumber(serving.amount)} ${unit})`
}

export function formatNutrientsServingLabel(
  food: Pick<SearchFoodResult, "nutrients" | "serving" | "base_unit">,
  amount: number,
): string {
  const unit = food.base_unit || "g"
  const ref = resolveNutrientsRefAmount(food.nutrients, food.serving, unit)
  const amt = Number(amount) || 0
  if (amt <= 0) return `per ${formatNumber(ref)} ${unit}`

  const name = food.serving.serving
  if (name && name !== "g" && name !== "ml" && name !== unit) {
    return `for ${formatNumber(amt)} ${unit} · ${formatServingLabel(name)}`
  }
  return `for ${formatNumber(amt)} ${unit}`
}

export function formatListNutrientLine(food: SearchFoodResult): string {
  const unit = food.base_unit || "g"
  const perGram = isPerGramNutrients(food.nutrients, unit, food.serving.serving_quantity)
  const scale = perGram ? 100 : 1
  const kcal = Math.round(food.nutrients.kcal * scale)
  const p = Math.round(food.nutrients.protein * scale * 10) / 10
  const c = Math.round(food.nutrients.carbs * scale * 10) / 10
  const f = Math.round(food.nutrients.fat * scale * 10) / 10

  const prefix = food.producer?.trim() ? `${food.producer.trim()} · ` : ""
  const portion = perGram
    ? `100 ${unit}`
    : `${formatNumber(food.serving.amount)} ${displayUnit(unit)}`

  return `${prefix}${portion} · ${kcal} kcal (P ${p}g · C ${c}g · F ${f}g)`
}

/** Subtitle for a recents usage row: the logged amount with its calories, e.g. "120 g · 92 Cal". */
export function formatUsageAmountLine(food: SearchFoodResult, amount: number): string {
  const unit = displayUnit(food.base_unit || "g")
  const kcal = Math.round(
    nutrientsForAmount(food.nutrients, food.serving, amount, food.base_unit || "g").kcal,
  )
  return `${formatNumber(amount)} ${unit} · ${kcal} Cal`
}
