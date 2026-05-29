import type { FoodNutrients, FoodServing } from '@/types';

/** Convert YAZIO energy to kcal using the account's `unit_energy` (kcal or kj). */
export function toKcal(energy: number, unitEnergy = 'kcal'): number {
  const unit = unitEnergy.trim().toLowerCase();
  if (unit === 'kj' || unit === 'kilojoule' || unit === 'kilojoules') {
    return Math.round(energy / 4.184);
  }
  return Math.round(energy);
}

export function nutrientsFromYazio(
  nutrients: Record<string, number>,
  unitEnergy = 'kcal',
): FoodNutrients {
  return {
    kcal: toKcal(nutrients['energy.energy'] ?? 0, unitEnergy),
    protein: roundMacro(nutrients['nutrient.protein'] ?? 0),
    carbs: roundMacro(nutrients['nutrient.carb'] ?? 0),
    fat: roundMacro(nutrients['nutrient.fat'] ?? 0),
  };
}

/**
 * Grams/ml (or base units) the stored `nutrients` values apply to.
 * YAZIO search can use `serving_quantity` when it differs from `amount`;
 * full product payloads are usually per 100 g/ml.
 */
function isBaseUnitServingLabel(servingName: string, baseUnit: string): boolean {
  const label = servingName.trim().toLowerCase();
  return (
    label === 'g' ||
    label === 'ml' ||
    label === 'gram' ||
    label === 'grams' ||
    label === baseUnit
  );
}

export function nutrientsReferenceAmount(
  serving: Pick<FoodServing, 'amount' | 'serving_quantity'> & {
    serving?: string;
  },
  baseUnit = 'g',
): number {
  const amount = serving.amount > 0 ? serving.amount : 100;
  const qty = serving.serving_quantity > 0 ? serving.serving_quantity : amount;

  if (qty === amount) return amount;

  // Per 100 g/ml label on product detail
  if (
    (baseUnit === 'g' || baseUnit === 'ml') &&
    qty === 100 &&
    amount !== 100
  ) {
    return 100;
  }

  // Search "gram" rows: nutrients are per serving_quantity (often 1 g), not default amount
  if (
    (baseUnit === 'g' || baseUnit === 'ml') &&
    isBaseUnitServingLabel(serving.serving ?? '', baseUnit)
  ) {
    return qty;
  }

  // Named portion (1 scoop, 1 bar, …) — nutrients match `amount`
  if (qty <= 10 && Number.isInteger(qty) && amount > qty) {
    return amount;
  }

  return qty;
}

export function scaleNutrients(
  base: FoodNutrients,
  baseAmount: number,
  targetAmount: number,
): FoodNutrients {
  if (baseAmount <= 0) return base;
  const factor = targetAmount / baseAmount;
  return {
    kcal: Math.round(base.kcal * factor),
    protein: roundMacro(base.protein * factor),
    carbs: roundMacro(base.carbs * factor),
    fat: roundMacro(base.fat * factor),
  };
}

export function nutrientsForAmount(
  base: FoodNutrients,
  serving: Pick<FoodServing, 'amount' | 'serving_quantity'> & {
    serving?: string;
  },
  targetAmount: number,
  baseUnit = 'g',
): FoodNutrients {
  const ref = nutrientsReferenceAmount(serving, baseUnit);
  return scaleNutrients(base, ref, targetAmount);
}

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10;
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
  );
}
