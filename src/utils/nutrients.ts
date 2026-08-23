import type { FoodNutrients, FoodServing, SearchFoodResult } from "@/types"

/** Convert YAZIO energy to kcal using the account `unit_energy`, either kcal or kj. */
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
 * Product detail API stores nutrients per gram or ml. Verified against live
 * payloads. Raw `energy.energy` is 0.1 to 9 kcal per gram. Banana is 0.89, olive oil
 * is 8.84, lettuce is 0.15. Default servings are named portions such as whole.regular
 * at 150 g, so the serving label is not a per-100 g signal.
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
 * `serving_quantity` is the reliable discriminator.
 * - Search rows carry `serving_quantity = 1` with nutrients per gram.
 * - Normalized product-detail cache rows carry `serving_quantity = 100`
 *   with nutrients per 100 g per ml. Even when the food is genuinely low-cal,
 *   for example diet drinks at about 0.4 kcal per 100 ml, those rows must not be read as per-gram.
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
  /** Scale raw API values before rounding. For example, use 100 to normalize per-gram to per-100 g. */
  multiplier = 1,
): FoodNutrients {
  const scale = multiplier
  const extract = (key: string, conversion = 1) => {
    const val = nutrients[key]
    if (val === undefined || val === null || Number.isNaN(val)) return undefined
    return roundNutrient(val * scale * conversion)
  }

  return {
    kcal: toKcal((nutrients["energy.energy"] ?? 0) * scale, unitEnergy),
    protein: roundMacro((nutrients["nutrient.protein"] ?? 0) * scale),
    carbs: roundMacro((nutrients["nutrient.carb"] ?? 0) * scale),
    fat: roundMacro((nutrients["nutrient.fat"] ?? 0) * scale),
    fiber: extract("nutrient.fiber"),
    sugar: extract("nutrient.sugar"),
    saturated_fat:
      extract("nutrient.saturated_fat") ??
      extract("nutrient.fat_sat") ??
      extract("nutrient.fat_saturated"),
    unsaturated_fat:
      extract("nutrient.unsaturated_fat") ??
      extract("nutrient.fat_unsat") ??
      extract("nutrient.fat_unsaturated"),
    sodium: extract("nutrient.sodium", 1000) ?? extract("nutrient.salt", 400),
    potassium: extract("nutrient.potassium", 1000),
    cholesterol: extract("nutrient.cholesterol", 1000),
    calcium: extract("nutrient.calcium", 1000),
    iron: extract("nutrient.iron", 1000),
    magnesium: extract("nutrient.magnesium", 1000),
    zinc: extract("nutrient.zinc", 1000),
    vitamin_a: extract("nutrient.vitamin_a"),
    vitamin_c: extract("nutrient.vitamin_c", 1000),
    vitamin_d: extract("nutrient.vitamin_d"),
    vitamin_b12: extract("nutrient.vitamin_b12"),
  }
}

/**
 * Standard Recommended Daily Intake, RDI or DRI, reference guidelines for adults.
 */
export const DAILY_RECOMMENDED_INTAKE = {
  fiber: { value: 30, unit: "g", label: "Dietary Fiber" },
  sugar: { value: 50, unit: "g", label: "Max Added Sugar" },
  saturated_fat: { value: 20, unit: "g", label: "Max Saturated Fat" },
  sodium: { value: 2300, unit: "mg", label: "Sodium" },
  potassium: { value: 3400, unit: "mg", label: "Potassium" },
  cholesterol: { value: 300, unit: "mg", label: "Cholesterol" },
  calcium: { value: 1000, unit: "mg", label: "Calcium" },
  iron: { value: 18, unit: "mg", label: "Iron" },
  magnesium: { value: 400, unit: "mg", label: "Magnesium" },
  zinc: { value: 11, unit: "mg", label: "Zinc" },
  vitamin_a: { value: 900, unit: "µg", label: "Vitamin A" },
  vitamin_c: { value: 90, unit: "mg", label: "Vitamin C" },
  vitamin_d: { value: 20, unit: "µg", label: "Vitamin D" },
  vitamin_b12: { value: 2.4, unit: "µg", label: "Vitamin B12" },
} as const

/**
 * Grams or ml, or base units, the stored `nutrients` values apply to.
 * YAZIO search can use `serving_quantity` when it differs from `amount`.
 * Full product payloads are usually per 100 g per ml.
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

  // Per 100 g per ml label on product detail
  if ((baseUnit === "g" || baseUnit === "ml") && qty === 100 && amount !== 100) {
    return 100
  }

  // Search gram rows: nutrients are per serving_quantity, often 1 g, not default amount
  if (
    (baseUnit === "g" || baseUnit === "ml") &&
    isBaseUnitServingLabelForRef(serving.serving ?? "", baseUnit)
  ) {
    // API often returns amount=100 with serving_quantity=1 while nutrients are per 100 g per ml
    if (qty === 1 && amount >= 100) return 100
    // Default portion, for example a 30 g bar, nutrients match `amount`, not 1 g
    if (qty === 1 && amount > 1) return amount
    return qty
  }

  // Named portion, for example 1 scoop or 1 bar, nutrients match `amount`. Only valid
  // for g or ml products. For countable base units such as each, cup, or stück, nutrients
  // are per base unit, so a multi-piece serving must scale from 1, not from
  // the option own amount.
  if (
    (baseUnit === "g" || baseUnit === "ml") &&
    qty <= 10 &&
    Number.isInteger(qty) &&
    amount > qty
  ) {
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
  if (
    !baseAmount ||
    baseAmount <= 0 ||
    !Number.isFinite(baseAmount) ||
    !Number.isFinite(targetAmount)
  ) {
    return base
  }
  const factor = targetAmount / baseAmount
  const scaleOpt = (val?: number) =>
    val !== undefined && Number.isFinite(val) ? roundNutrient(val * factor) : undefined

  return {
    kcal: Math.round((base.kcal || 0) * factor),
    protein: roundMacro((base.protein || 0) * factor),
    carbs: roundMacro((base.carbs || 0) * factor),
    fat: roundMacro((base.fat || 0) * factor),
    fiber: scaleOpt(base.fiber),
    sugar: scaleOpt(base.sugar),
    saturated_fat: scaleOpt(base.saturated_fat),
    unsaturated_fat: scaleOpt(base.unsaturated_fat),
    sodium: scaleOpt(base.sodium),
    potassium: scaleOpt(base.potassium),
    cholesterol: scaleOpt(base.cholesterol),
    calcium: scaleOpt(base.calcium),
    iron: scaleOpt(base.iron),
    magnesium: scaleOpt(base.magnesium),
    zinc: scaleOpt(base.zinc),
    vitamin_a: scaleOpt(base.vitamin_a),
    vitamin_c: scaleOpt(base.vitamin_c),
    vitamin_d: scaleOpt(base.vitamin_d),
    vitamin_b12: scaleOpt(base.vitamin_b12),
  }
}

export type MacroRatios = {
  macroKcal: number
  proteinPct: number
  carbsPct: number
  fatPct: number
}

/**
 * Compute the energy contribution and percentage ratios of protein, carbs, and fat.
 */
export function computeMacroRatios(protein: number, carbs: number, fat: number): MacroRatios {
  const pKcal = Math.max(0, protein || 0) * 4
  const cKcal = Math.max(0, carbs || 0) * 4
  const fKcal = Math.max(0, fat || 0) * 9
  const macroKcal = pKcal + cKcal + fKcal
  if (macroKcal <= 0) {
    return { macroKcal: 0, proteinPct: 0, carbsPct: 0, fatPct: 0 }
  }
  return {
    macroKcal: Math.round(macroKcal),
    proteinPct: Math.round((pKcal / macroKcal) * 100),
    carbsPct: Math.round((cKcal / macroKcal) * 100),
    fatPct: Math.round((fKcal / macroKcal) * 100),
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
 * Convert a per-gram or per-ml cache row from search data into a normalized per-100
 * display food, so a preview can render instantly from the cache. Only valid
 * for g or ml rows. Search rows for countable units, such as pieces or scoops, hold
 * per-item nutrients and must not be multiplied.
 */
export function normalizePerGramFood(food: SearchFoodResult): SearchFoodResult {
  const scale100 = (val?: number) => (val !== undefined ? roundNutrient(val * 100) : undefined)
  return {
    ...food,
    nutrients: {
      kcal: food.nutrients.kcal * 100,
      protein: food.nutrients.protein * 100,
      carbs: food.nutrients.carbs * 100,
      fat: food.nutrients.fat * 100,
      fiber: scale100(food.nutrients.fiber),
      sugar: scale100(food.nutrients.sugar),
      saturated_fat: scale100(food.nutrients.saturated_fat),
      unsaturated_fat: scale100(food.nutrients.unsaturated_fat),
      sodium: scale100(food.nutrients.sodium),
      potassium: scale100(food.nutrients.potassium),
      cholesterol: scale100(food.nutrients.cholesterol),
      calcium: scale100(food.nutrients.calcium),
      iron: scale100(food.nutrients.iron),
      magnesium: scale100(food.nutrients.magnesium),
      zinc: scale100(food.nutrients.zinc),
      vitamin_a: scale100(food.nutrients.vitamin_a),
      vitamin_c: scale100(food.nutrients.vitamin_c),
      vitamin_d: scale100(food.nutrients.vitamin_d),
      vitamin_b12: scale100(food.nutrients.vitamin_b12),
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

function roundNutrient(value: number): number {
  return Math.round(value * 10) / 10
}

export function sumNutrients(entries: FoodNutrients[]): FoodNutrients {
  const sumField = (key: keyof FoodNutrients) => {
    let sum = 0
    let hasAny = false
    for (const entry of entries) {
      const val = entry[key]
      if (val !== undefined && val > 0) {
        sum += val
        hasAny = true
      }
    }
    return hasAny ? roundNutrient(sum) : undefined
  }

  return {
    kcal: entries.reduce((acc, n) => acc + (n.kcal || 0), 0),
    protein: roundMacro(entries.reduce((acc, n) => acc + (n.protein || 0), 0)),
    carbs: roundMacro(entries.reduce((acc, n) => acc + (n.carbs || 0), 0)),
    fat: roundMacro(entries.reduce((acc, n) => acc + (n.fat || 0), 0)),
    fiber: sumField("fiber"),
    sugar: sumField("sugar"),
    saturated_fat: sumField("saturated_fat"),
    unsaturated_fat: sumField("unsaturated_fat"),
    sodium: sumField("sodium"),
    potassium: sumField("potassium"),
    cholesterol: sumField("cholesterol"),
    calcium: sumField("calcium"),
    iron: sumField("iron"),
    magnesium: sumField("magnesium"),
    zinc: sumField("zinc"),
    vitamin_a: sumField("vitamin_a"),
    vitamin_c: sumField("vitamin_c"),
    vitamin_d: sumField("vitamin_d"),
    vitamin_b12: sumField("vitamin_b12"),
  }
}
