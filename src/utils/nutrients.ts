import type { FoodNutrients } from '@/types';

/** YAZIO often returns energy in kJ; normalize to kcal for display/storage. */
export function toKcal(energy: number, unitEnergy = 'kcal'): number {
  if (unitEnergy.toLowerCase() === 'kj' || energy > 800) {
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
