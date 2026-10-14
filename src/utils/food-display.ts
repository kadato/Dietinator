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

/**
 * Detect countable / piece-based units (e.g. stück, piece, each, egg, serving).
 */
export function isCountableUnit(unit?: string | null): boolean {
  if (!unit) return false
  const lower = unit.toLowerCase().trim()
  return (
    lower === "stück" ||
    lower === "stk" ||
    lower === "stueck" ||
    lower === "piece" ||
    lower === "pieces" ||
    lower === "pc" ||
    lower === "pcs" ||
    lower === "each" ||
    lower === "item" ||
    lower === "items" ||
    lower === "portion" ||
    lower === "portions" ||
    lower === "serving" ||
    lower === "servings" ||
    lower === "egg" ||
    lower === "eggs" ||
    lower === "whole" ||
    lower === "slice" ||
    lower === "slices" ||
    lower === "can" ||
    lower === "cans" ||
    lower === "bottle" ||
    lower === "bottles" ||
    lower === "unit" ||
    lower === "units"
  )
}

/**
 * Natural short unit name for display (e.g. "pc" / "pcs", "serving" / "servings").
 */
export function formatUnitName(unit: string, amount: number = 1): string {
  const lower = (unit || "g").toLowerCase().trim()
  if (lower === "g" || lower === "ml") return lower
  const isSingle = Math.abs(amount - 1) < 0.001

  if (
    lower === "stück" ||
    lower === "stk" ||
    lower === "stueck" ||
    lower === "piece" ||
    lower === "pieces" ||
    lower === "pc" ||
    lower === "pcs" ||
    lower === "each" ||
    lower === "item" ||
    lower === "items" ||
    lower === "unit" ||
    lower === "units"
  ) {
    return isSingle ? "pc" : "pcs"
  }

  if (lower === "portion" || lower === "portions" || lower === "serving" || lower === "servings") {
    return isSingle ? "serving" : "servings"
  }

  if (lower === "slice" || lower === "slices") {
    return isSingle ? "slice" : "slices"
  }

  if (lower === "egg" || lower === "eggs") {
    return isSingle ? "egg" : "eggs"
  }

  if (lower === "can" || lower === "cans") {
    return isSingle ? "can" : "cans"
  }

  if (lower === "bottle" || lower === "bottles") {
    return isSingle ? "bottle" : "bottles"
  }

  return displayUnit(unit)
}

/**
 * Cleanly format an amount with its unit (e.g. "2 pcs", "1 pc", "100 g", "250 ml").
 */
export function formatFoodAmount(amount: number, unit: string): string {
  const cleanAmt = formatNumber(amount)
  if (isCountableUnit(unit)) {
    return `${cleanAmt} ${formatUnitName(unit, amount)}`
  }
  return `${cleanAmt} ${displayUnit(unit)}`
}

function isPieceServingCandidate(serving: FoodServing, baseUnit: string): boolean {
  if (!serving || !serving.serving || !serving.amount || serving.amount <= 0) return false
  const name = serving.serving.toLowerCase().trim()
  const unit = (baseUnit || "g").toLowerCase().trim()
  if (name === "g" || name === "ml" || name === unit) return false
  if (name === `100 ${unit}` || name === `100${unit}`) return false
  if (name === `1 ${unit}` || name === `1${unit}`) return false
  if (/^\d+\s*(g|ml)$/i.test(name)) return false
  return true
}

export function getEntryPieceSummary(entry: {
  amount: number
  unit: string
  food_name?: string
  serving?: FoodServing | null
  servings?: FoodServing[] | null
}): string | null {
  const amt = Number(entry.amount) || 0
  if (amt <= 0) return null
  const baseUnit = (entry.unit || "g").toLowerCase().trim()
  if (baseUnit !== "g" && baseUnit !== "ml") return null

  const candidates: FoodServing[] = []
  if (entry.serving && isPieceServingCandidate(entry.serving, baseUnit)) {
    candidates.push(entry.serving)
  }
  if (entry.servings?.length) {
    for (const s of entry.servings) {
      if (
        isPieceServingCandidate(s, baseUnit) &&
        !candidates.some((c) => c.serving === s.serving && c.amount === s.amount)
      ) {
        candidates.push(s)
      }
    }
  }

  if (candidates.length === 0) return null

  const foodNameLower = (entry.food_name || "").toLowerCase()
  const isEggFood =
    foodNameLower.includes("egg") ||
    foodNameLower.includes("ei ") ||
    foodNameLower.endsWith("ei") ||
    foodNameLower.includes("eier")

  const scored = candidates.map((s) => {
    const sLower = s.serving.toLowerCase()
    let score = 0
    if (
      sLower.includes("piece") ||
      sLower.includes("stück") ||
      sLower.includes("stk") ||
      sLower.includes("each") ||
      sLower.includes("item")
    ) {
      score += 10
    }
    if (sLower.includes("egg") || sLower.includes("ei")) score += 10
    if (isEggFood) score += 5
    if (sLower.includes("slice") || sLower.includes("scheibe")) score += 8
    if (sLower.includes("bar") || sLower.includes("riegel")) score += 8
    if (sLower.includes("can") || sLower.includes("dose")) score += 8
    if (sLower.includes("bottle") || sLower.includes("flasche")) score += 8
    if (sLower.includes("portion") || sLower.includes("serving")) score += 6

    const ratio = amt / s.amount
    const rounded = Math.round(ratio * 10) / 10
    const diff = Math.abs(rounded * s.amount - amt)
    const isCleanMultiplier =
      rounded > 0 &&
      diff <= 1 &&
      (Math.abs(rounded - Math.round(rounded)) < 0.05 ||
        Math.abs(rounded * 2 - Math.round(rounded * 2)) < 0.05)
    if (isCleanMultiplier) score += 20
    else score -= 50

    return { serving: s, score, rounded, diff, isCleanMultiplier }
  })

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (!best || !best.isCleanMultiplier) return null

  const sLower = best.serving.serving.toLowerCase()
  const rounded = best.rounded
  const isSingle = Math.abs(rounded - 1) < 0.05

  let unitWord = ""
  if (
    sLower.includes("egg") ||
    sLower.includes("piece") ||
    sLower.includes("stück") ||
    sLower.includes("stk") ||
    sLower.includes("each") ||
    sLower.includes("whole") ||
    sLower.includes("item") ||
    isEggFood
  ) {
    unitWord = isSingle ? "pc" : "pcs"
  } else if (sLower.includes("slice") || sLower.includes("scheibe")) {
    unitWord = isSingle ? "slice" : "slices"
  } else if (sLower.includes("bar") || sLower.includes("riegel")) {
    unitWord = isSingle ? "bar" : "bars"
  } else if (sLower.includes("can") || sLower.includes("dose")) {
    unitWord = isSingle ? "can" : "cans"
  } else if (sLower.includes("bottle") || sLower.includes("flasche")) {
    unitWord = isSingle ? "bottle" : "bottles"
  } else if (sLower.includes("portion") || sLower.includes("serving")) {
    unitWord = isSingle ? "serving" : "servings"
  } else {
    const pretty = formatServingLabel(best.serving.serving).replace(/\s*\(\d+.*?\)/, "")
    unitWord = pretty || (isSingle ? "portion" : "portions")
  }

  return `${formatNumber(rounded)} ${unitWord} (${formatNumber(amt)} ${entry.unit})`
}

/**
 * Formats a diary entry's amount for display in diary lists, search items, and collapsable cards.
 */
export function formatEntryAmount(entry: {
  amount: number
  unit: string
  food_name?: string
  serving?: FoodServing | null
  servings?: FoodServing[] | null
}): string {
  if (isCountableUnit(entry.unit)) {
    return formatFoodAmount(entry.amount, entry.unit)
  }

  const pieceSummary = getEntryPieceSummary(entry)
  if (pieceSummary) {
    return pieceSummary
  }

  return formatFoodAmount(entry.amount, entry.unit)
}

/**
 * Summary of a food portion for at-a-glance visibility in the logging UI.
 * Returns countText (e.g. "2 pcs" or "2 × 1 egg (55g)") and optional detailText (e.g. "110 g").
 */
export function getPortionSummary(
  food: Pick<SearchFoodResult, "serving" | "base_unit">,
  amount: number,
): { countText: string; subText?: string; isPiece: boolean } {
  const baseUnit = food.base_unit || "g"
  const amt = Number(amount) || 0

  // 1. Food has a countable base unit (stück, piece, each, etc.)
  if (isCountableUnit(baseUnit)) {
    const countText = formatFoodAmount(amt, baseUnit)
    const servingWeight = food.serving?.amount
    const subText =
      servingWeight && servingWeight > 1 ? `${formatNumber(amt * servingWeight)} g` : undefined
    return { countText, subText, isPiece: true }
  }

  // 2. Food base unit is g or ml, but a named serving option is selected (e.g. "1 medium egg (55g)")
  const servingAmt = food.serving?.amount || 0
  const servingName = food.serving?.serving || ""
  const isGramOrMlServing =
    servingName === "g" ||
    servingName === "ml" ||
    servingName === baseUnit ||
    servingName.endsWith(` ${baseUnit}`)

  if (servingAmt > 0 && !isGramOrMlServing) {
    const ratio = amt / servingAmt
    const roundedRatio = Math.round(ratio * 10) / 10
    // If the amount is a multiple of the serving (e.g. 1x, 2x, 3x, or 0.5x, 1.5x)
    if (roundedRatio > 0 && Math.abs(roundedRatio * servingAmt - amt) <= 1) {
      const isEggOrPiece =
        servingName.toLowerCase().includes("egg") ||
        servingName.toLowerCase().includes("piece") ||
        servingName.toLowerCase().includes("stück") ||
        servingName.toLowerCase().includes("whole") ||
        servingName.toLowerCase().includes("each")

      const pieceWord = roundedRatio === 1 ? "pc" : "pcs"
      const label = isEggOrPiece
        ? `${formatNumber(roundedRatio)} ${pieceWord}`
        : `${formatNumber(roundedRatio)} × ${formatServingLabel(servingName)}`

      return {
        countText: label,
        subText: `${formatNumber(amt)} ${baseUnit}`,
        isPiece: true,
      }
    }
  }

  return {
    countText: `${formatNumber(amt)} ${baseUnit}`,
    isPiece: false,
  }
}

export function formatNutrientsServingLabel(
  food: Pick<SearchFoodResult, "nutrients" | "serving" | "base_unit">,
  amount: number,
): string {
  const unit = food.base_unit || "g"
  const ref = resolveNutrientsRefAmount(food.nutrients, food.serving, unit)
  const amt = Number(amount) || 0
  if (amt <= 0) return `per ${formatNumber(ref)} ${displayUnit(unit)}`

  if (isCountableUnit(unit)) {
    return `for ${formatFoodAmount(amt, unit)}`
  }

  const name = food.serving.serving
  const servingAmt = food.serving.amount || 0
  if (name && name !== "g" && name !== "ml" && name !== unit) {
    if (servingAmt > 0 && Math.abs(servingAmt - amt) > 0.01) {
      const ratio = Math.round((amt / servingAmt) * 10) / 10
      if (ratio > 0 && Math.abs(ratio * servingAmt - amt) <= 1) {
        return `for ${formatNumber(amt)} ${unit} (${formatNumber(ratio)} × ${formatServingLabel(name)})`
      }
    }
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
