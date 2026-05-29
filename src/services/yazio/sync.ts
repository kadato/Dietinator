import type { DiaryEntry, MealType } from '@/types';
import * as diaryDb from '@/db/diary';
import * as foodCacheDb from '@/db/food-cache';
import { getSettings } from '@/db/settings';
import { matchesDateKey, toDateKey, toYazioApiDate } from '@/utils/date';
import { nutrientsForAmount, nutrientsFromYazio, toKcal } from '@/utils/nutrients';
import {
  getYazioClient,
  getYazioEnergyUnit,
  getYazioProfile,
  initYazioClient,
} from './client';
import { getFoodRemote } from './foods';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function syncEntryToYazio(entry: DiaryEntry): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.yazio_sync_enabled || !entry.food_id) return false;

  let yazio = getYazioClient();
  if (!yazio) yazio = await initYazioClient();
  if (!yazio) return false;

  try {
    const product = await getFoodRemote(entry.food_id);
    if (!product) return false;

    const yazioId = generateId();
    await yazio.user.addConsumedItem({
      id: yazioId,
      product_id: entry.food_id,
      date: entry.date,
      daytime: entry.meal_type as MealType,
      amount: entry.amount,
      serving: product.serving.serving,
      serving_quantity: product.serving.serving_quantity,
    });
    await diaryDb.markDiaryEntrySynced(entry.id, yazioId);
    return true;
  } catch {
    return false;
  }
}

export async function syncPendingEntries(): Promise<number> {
  const settings = await getSettings();
  if (!settings.yazio_sync_enabled) return 0;

  const pending = await diaryDb.getUnsyncedEntries();
  let synced = 0;
  for (const entry of pending) {
    const ok = await syncEntryToYazio(entry);
    if (ok) synced += 1;
  }
  return synced;
}

type YazioConsumedProduct = {
  id: string;
  date: string;
  product_id: string;
  amount: number;
  serving: string | null;
  serving_quantity: number | null;
  daytime: MealType;
};

type YazioSimpleProduct = {
  id: string;
  date: string;
  daytime: MealType;
  name: string;
  nutrients: Record<string, number>;
};

type YazioRecipePortion = {
  id: string;
  date: string;
  daytime: MealType;
  name?: string;
  nutrients?: Record<string, number>;
  amount?: number;
};

export type MealGoals = Partial<Record<MealType, number>>;

export type DiaryImportResult = {
  imported: number;
  skipped: number;
  failed: number;
  mealGoals: MealGoals;
  error?: string;
};

async function ensureYazioClient() {
  let yazio = getYazioClient();
  if (!yazio) yazio = await initYazioClient();
  return yazio;
}

async function fetchMealGoals(
  date: string,
): Promise<MealGoals> {
  const yazio = await ensureYazioClient();
  if (!yazio) return {};

  try {
    const unitEnergy = await getYazioEnergyUnit();
    const summary = await yazio.user.getDailySummary({
      date: toYazioApiDate(date),
    });
    const meals = summary.meals;
    return {
      breakfast: toKcal(meals.breakfast.energy_goal, unitEnergy),
      lunch: toKcal(meals.lunch.energy_goal, unitEnergy),
      dinner: toKcal(meals.dinner.energy_goal, unitEnergy),
      snack: toKcal(meals.snack.energy_goal, unitEnergy),
    };
  } catch {
    return {};
  }
}

async function importConsumedProduct(
  item: YazioConsumedProduct,
  date: string,
  existingIds: Set<string>,
  unitEnergy: string,
  productCache: Map<string, Awaited<ReturnType<typeof getFoodRemote>>>,
): Promise<'imported' | 'skipped' | 'failed'> {
  if (!matchesDateKey(item.date, date)) return 'skipped';
  if (existingIds.has(item.id)) return 'skipped';

  let food = productCache.get(item.product_id);
  if (food === undefined) {
    food = await getFoodRemote(item.product_id);
    productCache.set(item.product_id, food);
  }
  if (!food) return 'failed';

  const scaled = nutrientsForAmount(
    food.nutrients,
    food.serving,
    item.amount,
    food.base_unit,
  );

  await diaryDb.addDiaryEntry({
    id: generateId(),
    date,
    meal_type: item.daytime,
    food_id: item.product_id,
    food_name: food.name,
    amount: item.amount,
    unit: food.base_unit || 'g',
    kcal: scaled.kcal,
    protein: scaled.protein,
    carbs: scaled.carbs,
    fat: scaled.fat,
    created_at: new Date().toISOString(),
    yazio_synced: 1,
    yazio_item_id: item.id,
  });

  await foodCacheDb.saveFoodToCache(food);
  await foodCacheDb.touchFoodUsed(food.product_id);
  existingIds.add(item.id);
  return 'imported';
}

async function importSimpleProduct(
  item: YazioSimpleProduct,
  date: string,
  existingIds: Set<string>,
  unitEnergy: string,
): Promise<'imported' | 'skipped' | 'failed'> {
  if (!matchesDateKey(item.date, date)) return 'skipped';
  if (existingIds.has(item.id)) return 'skipped';
  if (!item.name?.trim()) return 'failed';

  const scaled = nutrientsFromYazio(item.nutrients ?? {}, unitEnergy);

  await diaryDb.addDiaryEntry({
    id: generateId(),
    date,
    meal_type: item.daytime,
    food_id: null,
    food_name: item.name.trim(),
    amount: 1,
    unit: 'serving',
    kcal: scaled.kcal,
    protein: scaled.protein,
    carbs: scaled.carbs,
    fat: scaled.fat,
    created_at: new Date().toISOString(),
    yazio_synced: 1,
    yazio_item_id: item.id,
  });

  existingIds.add(item.id);
  return 'imported';
}

async function importRecipePortion(
  item: YazioRecipePortion,
  date: string,
  existingIds: Set<string>,
  unitEnergy: string,
): Promise<'imported' | 'skipped' | 'failed'> {
  if (!matchesDateKey(item.date, date)) return 'skipped';
  if (existingIds.has(item.id)) return 'skipped';

  const name = item.name?.trim() || 'Recipe';
  const nutrients = item.nutrients ?? {};
  const scaled = nutrientsFromYazio(nutrients, unitEnergy);
  if (scaled.kcal <= 0 && !item.name) return 'failed';

  await diaryDb.addDiaryEntry({
    id: generateId(),
    date,
    meal_type: item.daytime,
    food_id: null,
    food_name: name,
    amount: item.amount ?? 1,
    unit: 'portion',
    kcal: scaled.kcal,
    protein: scaled.protein,
    carbs: scaled.carbs,
    fat: scaled.fat,
    created_at: new Date().toISOString(),
    yazio_synced: 1,
    yazio_item_id: item.id,
  });

  existingIds.add(item.id);
  return 'imported';
}

export async function importDiaryFromYazio(
  date: string = toDateKey(),
): Promise<DiaryImportResult> {
  const empty: DiaryImportResult = {
    imported: 0,
    skipped: 0,
    failed: 0,
    mealGoals: {},
  };

  const yazio = await ensureYazioClient();
  if (!yazio) return empty;

  const mealGoals = await fetchMealGoals(date);

  try {
    const [consumed, existingIds, unitEnergy] = await Promise.all([
      yazio.user.getConsumedItems({ date: toYazioApiDate(date) }),
      diaryDb.getYazioItemIdsForDate(date),
      getYazioEnergyUnit(),
    ]);

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const productCache = new Map<
      string,
      Awaited<ReturnType<typeof getFoodRemote>>
    >();

    for (const item of consumed.products as YazioConsumedProduct[]) {
      const result = await importConsumedProduct(
        item,
        date,
        existingIds,
        unitEnergy,
        productCache,
      );
      if (result === 'imported') imported += 1;
      else if (result === 'skipped') skipped += 1;
      else failed += 1;
    }

    for (const raw of consumed.simple_products as YazioSimpleProduct[]) {
      const result = await importSimpleProduct(raw, date, existingIds, unitEnergy);
      if (result === 'imported') imported += 1;
      else if (result === 'skipped') skipped += 1;
      else failed += 1;
    }

    for (const raw of consumed.recipe_portions as YazioRecipePortion[]) {
      const result = await importRecipePortion(raw, date, existingIds, unitEnergy);
      if (result === 'imported') imported += 1;
      else if (result === 'skipped') skipped += 1;
      else failed += 1;
    }

    return { imported, skipped, failed, mealGoals };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not reach YAZIO.';
    return { ...empty, mealGoals, error: message };
  }
}

/** Import daily goals and consumed foods from YAZIO for one date. */
export async function importFromYazio(
  date: string = toDateKey(),
): Promise<DiaryImportResult> {
  await loadGoalsFromYazio(date);
  return importDiaryFromYazio(date);
}

export async function loadGoalsFromYazio(date: string = toDateKey()): Promise<void> {
  const yazio = await ensureYazioClient();
  if (!yazio) return;

  try {
    const [goals, profile, unitEnergy] = await Promise.all([
      yazio.user.getGoals({ date: toYazioApiDate(date) }),
      getYazioProfile(),
      getYazioEnergyUnit(),
    ]);
    const { updateSettings } = await import('@/db/settings');
    await updateSettings({
      calorie_goal: toKcal(goals['energy.energy'] ?? 2000, unitEnergy),
      protein_goal: goals['nutrient.protein'] ?? 150,
      carbs_goal: goals['nutrient.carb'] ?? 200,
      fat_goal: goals['nutrient.fat'] ?? 65,
      ...(profile?.food_database_country
        ? { food_database_country: profile.food_database_country }
        : {}),
    });
  } catch {
    // Goals stay local defaults
  }
}
