import * as diaryDb from '@/db/diary';
import * as foodCacheDb from '@/db/food-cache';
import type { DiaryEntry, FoodNutrients, MealType, SearchFoodResult } from '@/types';
import { nutrientsForAmount } from '@/utils/nutrients';
import { getFoodRemote } from './yazio/foods';
import { syncEntryToYazio } from './yazio/sync';

function nutrientsDiffer(a: FoodNutrients, b: FoodNutrients): boolean {
  return (
    Math.abs(a.kcal - b.kcal) > 1 ||
    Math.abs(a.protein - b.protein) > 0.2 ||
    Math.abs(a.carbs - b.carbs) > 0.2 ||
    Math.abs(a.fat - b.fat) > 0.2
  );
}

function looksUnderScaled(entry: DiaryEntry): boolean {
  if (entry.unit !== 'g' && entry.unit !== 'ml') return false;
  if (entry.amount < 15) return false;
  const perUnit = entry.kcal / entry.amount;
  return perUnit < 0.2;
}

async function reconcileEntryNutrients(entry: DiaryEntry): Promise<DiaryEntry> {
  if (!entry.food_id) return entry;

  let food = await foodCacheDb.getFoodById(entry.food_id);
  if (!food || looksUnderScaled(entry)) {
    food = (await getFoodRemote(entry.food_id)) ?? food;
  }
  if (!food) return entry;

  const scaled = nutrientsForAmount(
    food.nutrients,
    food.serving,
    entry.amount,
    food.base_unit,
  );
  if (!nutrientsDiffer(scaled, entry)) return entry;

  await diaryDb.updateDiaryEntryNutrients(entry.id, scaled);
  return { ...entry, ...scaled };
}

export async function getDiaryEntriesForDate(
  date: string,
): Promise<DiaryEntry[]> {
  const entries = await diaryDb.getDiaryEntriesForDate(date);
  return Promise.all(entries.map(reconcileEntryNutrients));
}

export async function getDiaryTotalsForDate(
  date: string,
): Promise<FoodNutrients> {
  const entries = await getDiaryEntriesForDate(date);
  return entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

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
  const scaled = nutrientsForAmount(
    food.nutrients,
    food.serving,
    amount,
    food.base_unit,
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

export { exportDiaryJson, exportDiaryCsv } from '@/db/diary';
