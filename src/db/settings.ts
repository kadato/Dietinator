import type { AppSettings } from '@/types';
import { getDatabase } from './database';

export async function getSettings(): Promise<AppSettings> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AppSettings>(
    'SELECT calorie_goal, protein_goal, carbs_goal, fat_goal, units, yazio_sync_enabled, food_database_country FROM settings WHERE id = 1',
  );
  return (
    row ?? {
      calorie_goal: 2000,
      protein_goal: 150,
      carbs_goal: 200,
      fat_goal: 65,
      units: 'metric',
      yazio_sync_enabled: 0,
      food_database_country: '',
    }
  );
}

export async function updateSettings(
  partial: Partial<AppSettings>,
): Promise<void> {
  const db = await getDatabase();
  const current = await getSettings();
  const next = { ...current, ...partial };
  await db.runAsync(
    `UPDATE settings SET
      calorie_goal = ?,
      protein_goal = ?,
      carbs_goal = ?,
      fat_goal = ?,
      units = ?,
      yazio_sync_enabled = ?,
      food_database_country = ?
    WHERE id = 1`,
    next.calorie_goal,
    next.protein_goal,
    next.carbs_goal,
    next.fat_goal,
    next.units,
    next.yazio_sync_enabled,
    next.food_database_country,
  );
}
