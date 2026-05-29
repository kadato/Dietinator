import type { FoodServing, SearchFoodResult } from '@/types';
import { nutrientsReferenceAmount } from '@/utils/nutrients';

export function formatServingOption(
  serving: FoodServing,
  baseUnit: string,
): string {
  const label = serving.serving || baseUnit;
  if (label === 'g' || label === 'ml' || label === baseUnit) {
    return `${serving.amount} ${baseUnit}`;
  }
  return `${label} (${serving.amount} ${baseUnit})`;
}

export function formatNutrientsServingLabel(
  food: Pick<SearchFoodResult, 'serving' | 'base_unit'>,
  amount: number,
): string {
  const unit = food.base_unit || 'g';
  const ref = nutrientsReferenceAmount(food.serving, unit);
  const amt = Number(amount) || 0;
  if (amt <= 0) return `per ${ref} ${unit}`;

  const name = food.serving.serving;
  if (name && name !== 'g' && name !== 'ml' && name !== unit) {
    return `for ${amt} ${unit} · ${name}`;
  }
  return `for ${amt} ${unit}`;
}

export function formatListNutrientLine(food: SearchFoodResult): string {
  const unit = food.base_unit || 'g';
  const ref = nutrientsReferenceAmount(food.serving, unit);
  const prefix = food.producer ? `${food.producer} · ` : '';
  const servingLabel =
    ref === food.serving.amount
      ? `${ref}${unit}`
      : `${ref}${unit} (default ${food.serving.amount}${unit})`;
  return `${prefix}${food.nutrients.kcal} kcal / ${servingLabel}`;
}
