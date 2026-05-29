import type { DiaryEntry, MealType } from '@/types';
import * as diaryDb from '@/db/diary';
import { getSettings } from '@/db/settings';
import { getYazioClient, initYazioClient } from './client';
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

export async function loadGoalsFromYazio(): Promise<void> {
  let yazio = getYazioClient();
  if (!yazio) yazio = await initYazioClient();
  if (!yazio) return;

  try {
    const goals = await yazio.user.getGoals({ date: new Date() });
    const { updateSettings } = await import('@/db/settings');
    const { toKcal } = await import('@/utils/nutrients');
    await updateSettings({
      calorie_goal: toKcal(goals['energy.energy'] ?? 2000),
      protein_goal: goals['nutrient.protein'] ?? 150,
      carbs_goal: goals['nutrient.carb'] ?? 200,
      fat_goal: goals['nutrient.fat'] ?? 65,
    });
  } catch {
    // Goals stay local defaults
  }
}
