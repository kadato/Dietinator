import type { WeightEntry } from "@/types"
import { generateId } from "@/utils/id"
import { getDatabase } from "./database"

const COLUMNS = "id, date, weight_kg, note, created_at"

export async function getWeightEntries(fromDateKey?: string): Promise<WeightEntry[]> {
  const db = await getDatabase()
  if (fromDateKey) {
    return db.getAllAsync<WeightEntry>(
      `SELECT ${COLUMNS} FROM weight_entries WHERE date >= ? ORDER BY date ASC`,
      [fromDateKey],
    )
  }
  return db.getAllAsync<WeightEntry>(`SELECT ${COLUMNS} FROM weight_entries ORDER BY date ASC`)
}

export async function getLatestWeightEntry(): Promise<WeightEntry | null> {
  const [latest] = await getRecentWeightEntries(1)
  return latest ?? null
}

/** The most recent `limit` weight entries, newest first, for change deltas. */
export async function getRecentWeightEntries(limit = 2): Promise<WeightEntry[]> {
  const db = await getDatabase()
  return db.getAllAsync<WeightEntry>(
    `SELECT ${COLUMNS} FROM weight_entries ORDER BY date DESC LIMIT ?`,
    [limit],
  )
}

export async function getWeightEntryForDate(date: string): Promise<WeightEntry | null> {
  const db = await getDatabase()
  const row = await db.getFirstAsync<WeightEntry>(
    `SELECT ${COLUMNS} FROM weight_entries WHERE date = ?`,
    date,
  )
  return row ?? null
}

/** Upsert per date. Re-weighing the same day updates the existing entry. */
export async function saveWeightEntry(input: {
  date: string
  weightKg: number
  note?: string
}): Promise<void> {
  const db = await getDatabase()
  const note = input.note?.trim() ? input.note.trim() : null
  await db.runAsync(
    `INSERT INTO weight_entries (id, date, weight_kg, note, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       weight_kg = excluded.weight_kg,
       note = excluded.note`,
    generateId(),
    input.date,
    input.weightKg,
    note,
    new Date().toISOString(),
  )
}

export async function deleteWeightEntry(id: string): Promise<void> {
  const db = await getDatabase()
  await db.runAsync("DELETE FROM weight_entries WHERE id = ?", id)
}
