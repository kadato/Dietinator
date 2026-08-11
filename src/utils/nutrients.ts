import type { FoodNutrients, FoodServing, SearchFoodResult } from "@/types"

/** Convert YAZIO energy to kcal using the account's `unit_energy` (kcal or kj). */
export function toKcal(energy: number, unitEnergy = "kcal"): number {
  const unit = unitEnergy.trim().toLowerCase()
  if (unit === "kj" || unit === "kilojoule" || unit === "kilojoules") {
    return Math.round(energy / 4.184)
  }
  return Math.round(energy)
}

/** Unrounded kcal from a YAZIO nutrient payload. */
export function rawEnergyKcal(nutrients: Record<string, number>, unitEnergy = "kcal"): number {
  const energy = nutrients["energy.energy"] ?? 0
  const unit = unitEnergy.trim().toLowerCase()
  if (unit === "kj" || unit === "kilojoule" || unit === "kilojoules") {
    return energy / 4.184
  }
  return energy
}

/**
 * Product detail API stores nutrients per gram/ml. Verified against live
 * payloads: raw `energy.energy` is 0.1–9 kcal per gram (banana 0.89, olive oil
 * 8.84, lettuce 0.15) and default servings are named portions ("whole.regular"
 * @150 g) — the serving label is NOT a per-100 g signal.
 */
export function isPerGramRawNutrients(
  nutrients: Record<string, number>,
  baseUnit: string,
  unitEnergy = "kcal",
): boolean {
  const kcal = rawEnergyKcal(nutrients, unitEnergy)
  return (baseUnit === "g" || baseUnit === "ml") && kcal > 0 && kcal < 10
}

/**
 * Detect per-gram values already stored in cache.
 *
 * `serving_quantity` is the reliable discriminator:
 * - Search rows carry `serving_quantity = 1` with nutrients per gram.
 * - Normalized product-detail cache rows carry `serving_quantity = 100`
 *   (nutrients per 100 g/ml) — even when the food is genuinely low-cal
 *   (e.g. diet drinks ~0.4 kcal/100 ml), those must NOT be read as per-gram.
 */
export function isPerGramNutrients(
  nutrients: FoodNutrients,
  baseUnit = "g",
  servingQuantity?: number,
): boolean {
  if (!(baseUnit === "g" || baseUnit === "ml")) return false
  if (nutrients.kcal <= 0 || nutrients.kcal >= 10) return false
  if (servingQuantity !== undefined && servingQuantity > 1) return false
  return true
}

export function nutrientsFromYazio(
  nutrients: Record<string, number>,
  unitEnergy = "kcal",
  /** Scale raw API values before rounding (e.g. 100 to normalize per-gram → per-100 g). */
  multiplier = 1,
): FoodNutrients {
  const scale = multiplier
  return {
    kcal: toKcal((nutrients["energy.energy"] ?? 0) * scale, unitEnergy),
    protein: roundMacro((nutrients["nutrient.protein"] ?? 0) * scale),
    carbs: roundMacro((nutrients["nutrient.carb"] ?? 0) * scale),
    fat: roundMacro((nutrients["nutrient.fat"] ?? 0) * scale),
  }
}

/**
 * Grams/ml (or base units) the stored `nutrients` values apply to.
 * YAZIO search can use `serving_quantity` when it differs from `amount`;
 * full product payloads are usually per 100 g/ml.
 */
function isBaseUnitServingLabelForRef(servingName: string, baseUnit: string): boolean {
  const label = servingName.trim().toLowerCase()
  return (
    label === "g" || label === "ml" || label === "gram" || label === "grams" || label === baseUnit
  )
}

export function nutrientsReferenceAmount(
  serving: Pick<FoodServing, "amount" | "serving_quantity"> & {
    serving?: string
  },
  baseUnit = "g",
): number {
  const amount = serving.amount > 0 ? serving.amount : 100
  const qty = serving.serving_quantity > 0 ? serving.serving_quantity : amount

  if (qty === amount) return amount

  // Per 100 g/ml label on product detail
  if ((baseUnit === "g" || baseUnit === "ml") && qty === 100 && amount !== 100) {
    return 100
  }

  // Search "gram" rows: nutrients are per serving_quantity (often 1 g), not default amount
  if (
    (baseUnit === "g" || baseUnit === "ml") &&
    isBaseUnitServingLabelForRef(serving.serving ?? "", baseUnit)
  ) {
    // API often returns amount=100 with serving_quantity=1 while nutrients are per 100 g/ml
    if (qty === 1 && amount >= 100) return 100
    // Default portion (e.g. 30 g bar) — nutrients match `amount`, not 1 g
    if (qty === 1 && amount > 1) return amount
    return qty
  }

  // Named portion (1 scoop, 1 bar, …) — nutrients match `amount`. Only valid
  // for g/ml products: for countable base units (each, cup, stück) nutrients
  // are per base unit, so a multi-piece serving must scale from 1, not from
  // the option's own amount.
  if ((baseUnit === "g" || baseUnit === "ml") && qty <= 10 && Number.isInteger(qty) && amount > qty) {
    return amount
  }

  return qty
}

/** Resolve how many base units the stored nutrient values represent. */
export function resolveNutrientsRefAmount(
  nutrients: FoodNutrients,
  serving: Pick<FoodServing, "amount" | "serving_quantity"> & {
    serving?: string
  },
  baseUnit = "g",
): number {
  if (isPerGramNutrients(nutrients, baseUnit, serving.serving_quantity)) return 1
  return nutrientsReferenceAmount(serving, baseUnit)
}

export function scaleNutrients(
  base: FoodNutrients,
  baseAmount: number,
  targetAmount: number,
): FoodNutrients {
  if (baseAmount <= 0) return base
  const factor = targetAmount / baseAmount
  return {
    kcal: Math.round(base.kcal * factor),
    protein: roundMacro(base.protein * factor),
    carbs: roundMacro(base.carbs * factor),
    fat: roundMacro(base.fat * factor),
  }
}

export function nutrientsForAmount(
  base: FoodNutrients,
  serving: Pick<FoodServing, "amount" | "serving_quantity"> & {
    serving?: string
  },
  targetAmount: number,
  baseUnit = "g",
): FoodNutrients {
  const ref = resolveNutrientsRefAmount(base, serving, baseUnit)
  return scaleNutrients(base, ref, targetAmount)
}

/**
 * Convert a per-gram/per-ml cache row (search data) into a normalized per-100
 * display food, so a preview can render instantly from the cache. Only valid
 * for g/ml rows — search rows for countable units (pieces, scoops) hold
 * per-item nutrients and must not be multiplied.
 */
export function normalizePerGramFood(food: SearchFoodResult): SearchFoodResult {
  return {
    ...food,
    nutrients: {
      kcal: food.nutrients.kcal * 100,
      protein: food.nutrients.protein * 100,
      carbs: food.nutrients.carbs * 100,
      fat: food.nutrients.fat * 100,
    },
    serving: {
      serving: food.base_unit === "ml" ? "100 ml" : "100 g",
      amount: 100,
      serving_quantity: 100,
    },
  }
}

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10
}

export function sumNutrients(entries: FoodNutrients[]): FoodNutrients {
  return entries.reduce(
    (acc, n) => ({
      kcal: acc.kcal + n.kcal,
      protein: roundMacro(acc.protein + n.protein),
      carbs: roundMacro(acc.carbs + n.carbs),
      fat: roundMacro(acc.fat + n.fat),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}
