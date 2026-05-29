import type { MealType } from '@/types';

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export const MEAL_PLACEHOLDERS: Record<MealType, string> = {
  breakfast: 'What did you have for breakfast?',
  lunch: 'What did you have for lunch?',
  dinner: 'What did you have for dinner?',
  snack: 'What did you have for a snack?',
};
