import type { DiaryEntry, FoodNutrients, MealType } from "@/types"
import { getDatabase } from "./database"

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
  }
}

export async function getDiaryEntriesForDate(date: string): Promise<DiaryEntry[]> {
  const db = await getDatabase()
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM diary_entries WHERE date = ? ORDER BY created_at ASC",
    date,
  )
  return rows.map(rowToEntry)
}

export async function getDiaryEntryCount(): Promise<number> {
  const db = await getDatabase()
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM diary_entries",
  )
  return Number(row?.count ?? 0)
}

export async function getDiaryEntryById(id: string): Promise<DiaryEntry | null> {
  const db = await getDatabase()
  const row = await db.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM diary_entries WHERE id = ?",
    id,
  )
  return row ? rowToEntry(row) : null
}

export async function addDiaryEntry(
  entry: Omit<DiaryEntry, "yazio_synced" | "yazio_item_id"> & {
    yazio_synced?: number
    yazio_item_id?: string | null
  },
): Promise<DiaryEntry> {
  const db = await getDatabase()
  const full: DiaryEntry = {
    ...entry,
    yazio_synced: entry.yazio_synced ?? 0,
    yazio_item_id: entry.yazio_item_id ?? null,
  }
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
  )
  return full
}

export async function removeDiaryEntry(id: string): Promise<void> {
  const db = await getDatabase()
  await db.runAsync("DELETE FROM diary_entries WHERE id = ?", id)
}

export async function updateDiaryEntryNutrients(
  id: string,
  nutrients: FoodNutrients,
): Promise<void> {
  const db = await getDatabase()
  await db.runAsync(
    "UPDATE diary_entries SET kcal = ?, protein = ?, carbs = ?, fat = ? WHERE id = ?",
    nutrients.kcal,
    nutrients.protein,
    nutrients.carbs,
    nutrients.fat,
    id,
  )
}

export async function updateDiaryEntryDetails(
  id: string,
  details: {
    amount: number
    unit?: string
    meal_type?: MealType
    food_name?: string
    nutrients?: FoodNutrients
  },
): Promise<void> {
  const db = await getDatabase()
  await db.runAsync(
    `UPDATE diary_entries SET
      amount = ?,
      unit = ?,
      meal_type = ?,
      food_name = ?,
      kcal = ?,
      protein = ?,
      carbs = ?,
      fat = ?
    WHERE id = ?`,
    details.amount,
    details.unit ?? "g",
    details.meal_type ?? "lunch",
    details.food_name ?? "",
    details.nutrients?.kcal ?? 0,
    details.nutrients?.protein ?? 0,
    details.nutrients?.carbs ?? 0,
    details.nutrients?.fat ?? 0,
    id,
  )
}

/** Reserve the YAZIO item id before the network push so retries reuse it (idempotent sync). */
export async function reserveYazioItemId(id: string, yazioItemId: string): Promise<void> {
  const db = await getDatabase()
  await db.runAsync("UPDATE diary_entries SET yazio_item_id = ? WHERE id = ?", yazioItemId, id)
}

export async function markDiaryEntrySynced(id: string, yazioItemId: string): Promise<void> {
  const db = await getDatabase()
  await db.runAsync(
    "UPDATE diary_entries SET yazio_synced = 1, yazio_item_id = ? WHERE id = ?",
    yazioItemId,
    id,
  )
}

export async function getYazioItemIdsForDate(date: string): Promise<Set<string>> {
  const db = await getDatabase()
  const rows = await db.getAllAsync<{ yazio_item_id: string | null }>(
    "SELECT yazio_item_id FROM diary_entries WHERE date = ? AND yazio_item_id IS NOT NULL",
    date,
  )
  const ids = new Set<string>()
  for (const row of rows) {
    if (row.yazio_item_id) ids.add(row.yazio_item_id)
  }
  return ids
}

export async function getUnsyncedEntries(limit = 20): Promise<DiaryEntry[]> {
  const db = await getDatabase()
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM diary_entries WHERE yazio_synced = 0 AND food_id IS NOT NULL ORDER BY created_at ASC LIMIT ?",
    limit,
  )
  return rows.map(rowToEntry)
}

export async function getDeletedYazioItemIds(): Promise<Set<string>> {
  const db = await getDatabase()
  const rows = await db.getAllAsync<{ id: string }>("SELECT id FROM deleted_yazio_items")
  return new Set(rows.map((row) => row.id))
}

export async function isDeletedYazioItemId(id: string): Promise<boolean> {
  const db = await getDatabase()
  const row = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM deleted_yazio_items WHERE id = ?",
    id,
  )
  return row !== null
}

export async function addDeletedYazioItemId(id: string): Promise<void> {
  const db = await getDatabase()
  await db.runAsync(
    "INSERT OR IGNORE INTO deleted_yazio_items (id, deleted_at) VALUES (?, ?)",
    id,
    new Date().toISOString(),
  )
}

export async function removeDeletedYazioItemId(id: string): Promise<void> {
  const db = await getDatabase()
  await db.runAsync("DELETE FROM deleted_yazio_items WHERE id = ?", id)
}

/** Keep tombstones tidy: drop anything older than 90 days. */
export async function pruneDeletedYazioItems(days = 90): Promise<void> {
  const db = await getDatabase()
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  await db.runAsync("DELETE FROM deleted_yazio_items WHERE deleted_at < ?", cutoff)
}

export async function exportDiaryJson(): Promise<string> {
  const db = await getDatabase()
  const rows = await db.getAllAsync(
    "SELECT * FROM diary_entries ORDER BY date DESC, created_at DESC",
  )
  return JSON.stringify(rows, null, 2)
}

/** Quote every CSV field and neutralize spreadsheet formula injection. */
function csvCell(value: unknown): string {
  let text = String(value ?? "")
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  text = text.replace(/"/g, '""').replace(/[\r\n]+/g, " ")
  return `"${text}"`
}

export async function exportDiaryCsv(): Promise<string> {
  const db = await getDatabase()
  const rows = await db.getAllAsync<DiaryEntry>(
    "SELECT * FROM diary_entries ORDER BY date DESC, created_at DESC",
  )
  const header = "date,meal_type,food_name,amount,unit,kcal,protein,carbs,fat"
  const lines = rows.map((r) =>
    [
      csvCell(r.date),
      csvCell(r.meal_type),
      csvCell(r.food_name),
      csvCell(r.amount),
      csvCell(r.unit),
      csvCell(r.kcal),
      csvCell(r.protein),
      csvCell(r.carbs),
      csvCell(r.fat),
    ].join(","),
  )
  return [header, ...lines].join("\n")
}
