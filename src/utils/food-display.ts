import type { FoodServing, SearchFoodResult } from "@/types"
import {
  isPerGramNutrients,
  nutrientsForAmount,
  resolveNutrientsRefAmount,
} from "@/utils/nutrients"
import { formatNumber } from "@/utils/format"

/** YAZIO serving keys are dotted ids, such as whole.regular and small.piece. Show readable labels. */
export function formatServingLabel(label: string): string {
  return label
    .split(".")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/** Human label for a YAZIO base unit. G and ml stay, countable units get English names. */
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
  // Plain unit labels such as 100 g and 250 ml and countable labels that are just
  // the unit, such as each on a stück product, render without the redundant
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
  // Names like "1 medium (118g)" already carry the amount. Appending it again
  // would read "1 medium (118g) (118 g)".
  if (new RegExp(`\\b${serving.amount}\\s*${unit}\\b`, "i").test(label)) {
    return pretty
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
    return `for ${formatNumber(amt)} ${unit}, ${formatServingLabel(name)}`
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

  const prefix = food.producer?.trim() ? `${food.producer.trim()}, ` : ""
  const portion = perGram
    ? `100 ${unit}`
    : `${formatNumber(food.serving.amount)} ${displayUnit(unit)}`

  return `${prefix}${kcal} kcal, ${p}g P, ${c}g C, ${f}g F, ${portion}`
}

/** Subtitle for a recents usage row. Shows the logged amount with its calories and macros, for example 92 kcal, 15g P, 4g C, 2g F, 120 g. */
export function formatUsageAmountLine(food: SearchFoodResult, amount: number): string {
  const unit = displayUnit(food.base_unit || "g")
  const nutrients = nutrientsForAmount(food.nutrients, food.serving, amount, food.base_unit || "g")
  const kcal = Math.round(nutrients.kcal)
  const p = Math.round(nutrients.protein * 10) / 10
  const c = Math.round(nutrients.carbs * 10) / 10
  const f = Math.round(nutrients.fat * 10) / 10
  const prefix = food.producer?.trim() ? `${food.producer.trim()}, ` : ""
  return `${prefix}${kcal} kcal, ${p}g P, ${c}g C, ${f}g F, ${formatNumber(amount)} ${unit}`
}
