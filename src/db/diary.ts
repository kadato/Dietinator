import type { DiaryEntry, FoodNutrients, MealType } from '@/types';
import { getDatabase } from './database';

function rowToEntry(row: Record<string, unknown>): DiaryEntry {
  return {
    id: String(row.id),
    date: String(row.date),
    meal_type: row.meal_type as MealType,
    food_id: row.food_id ? String(row.food_id) : null,
    food_name: String(row.food_name),
    amount: Number(row.amount),
    unit: String(row.unit),
    kcal: Number(row.kcal),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    created_at: String(row.created_at),
    yazio_synced: Number(row.yazio_synced),
    yazio_item_id: row.yazio_item_id ? String(row.yazio_item_id) : null,
  };
}

export async function getDiaryEntriesForDate(
  date: string,
): Promise<DiaryEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM diary_entries WHERE date = ? ORDER BY created_at ASC',
    date,
  );
  return rows.map(rowToEntry);
}

export async function addDiaryEntry(entry: Omit<DiaryEntry, 'yazio_synced' | 'yazio_item_id'> & {
  yazio_synced?: number;
  yazio_item_id?: string | null;
}): Promise<DiaryEntry> {
  const db = await getDatabase();
  const full: DiaryEntry = {
    ...entry,
    yazio_synced: entry.yazio_synced ?? 0,
    yazio_item_id: entry.yazio_item_id ?? null,
  };
  await db.runAsync(
    `INSERT INTO diary_entries (
      id, date, meal_type, food_id, food_name, amount, unit,
      kcal, protein, carbs, fat, created_at, yazio_synced, yazio_item_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    full.id,
    full.date,
    full.meal_type,
    full.food_id,
    full.food_name,
    full.amount,
    full.unit,
    full.kcal,
    full.protein,
    full.carbs,
    full.fat,
    full.created_at,
    full.yazio_synced,
    full.yazio_item_id,
  );
  return full;
}

export async function removeDiaryEntry(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM diary_entries WHERE id = ?', id);
}

export async function markDiaryEntrySynced(
  id: string,
  yazioItemId: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE diary_entries SET yazio_synced = 1, yazio_item_id = ? WHERE id = ?',
    yazioItemId,
    id,
  );
}

export async function getUnsyncedEntries(): Promise<DiaryEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM diary_entries WHERE yazio_synced = 0 AND food_id IS NOT NULL',
  );
  return rows.map(rowToEntry);
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

export async function exportDiaryJson(): Promise<string> {
  const db = await getDatabase();
  const rows = await db.getAllAsync('SELECT * FROM diary_entries ORDER BY date DESC, created_at DESC');
  return JSON.stringify(rows, null, 2);
}

export async function exportDiaryCsv(): Promise<string> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DiaryEntry>('SELECT * FROM diary_entries ORDER BY date DESC, created_at DESC');
  const header = 'date,meal_type,food_name,amount,unit,kcal,protein,carbs,fat';
  const lines = rows.map(
    (r) =>
      `${r.date},${r.meal_type},"${r.food_name.replace(/"/g, '""')}",${r.amount},${r.unit},${r.kcal},${r.protein},${r.carbs},${r.fat}`,
  );
  return [header, ...lines].join('\n');
}
