import * as diaryDb from '@/db/diary';
import * as foodCacheDb from '@/db/food-cache';
import type { DiaryEntry, FoodNutrients, MealType, SearchFoodResult } from '@/types';
import { scaleNutrients } from '@/utils/nutrients';
import { syncEntryToYazio } from './yazio/sync';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function logFood(params: {
  date: string;
  mealType: MealType;
  food: SearchFoodResult;
  amount: number;
}): Promise<DiaryEntry> {
  const { date, mealType, food, amount } = params;
  const scaled = scaleNutrients(
    food.nutrients,
    food.serving.amount,
    amount,
  );

  const entry = await diaryDb.addDiaryEntry({
    id: generateId(),
    date,
    meal_type: mealType,
    food_id: food.product_id,
    food_name: food.name,
    amount,
    unit: food.base_unit || 'g',
    kcal: scaled.kcal,
    protein: scaled.protein,
    carbs: scaled.carbs,
    fat: scaled.fat,
    created_at: new Date().toISOString(),
  });

  await foodCacheDb.saveFoodToCache(food);
  await foodCacheDb.touchFoodUsed(food.product_id);

  syncEntryToYazio(entry).catch(() => undefined);

  return entry;
}

export async function deleteFoodEntry(id: string): Promise<void> {
  await diaryDb.removeDiaryEntry(id);
}

export {
  getDiaryEntriesForDate,
  getDiaryTotalsForDate,
  exportDiaryJson,
  exportDiaryCsv,
} from '@/db/diary';
