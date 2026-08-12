import type { WaterEntry } from "@/types"
import { generateId } from "@/utils/id"
import { getDatabase } from "./database"

const COLUMNS = "id, date, amount_ml, created_at"

function rowToEntry(row: Record<string, unknown>): WaterEntry {
  return {
    id: String(row.id),
    date: String(row.date),
    amount_ml: Number(row.amount_ml),
    created_at: String(row.created_at),
  }
}

export async function getWaterEntriesForDate(date: string): Promise<WaterEntry[]> {
  const db = await getDatabase()
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT ${COLUMNS} FROM water_log WHERE date = ? ORDER BY created_at ASC`,
    date,
  )
  return rows.map(rowToEntry)
}

/** Total water logged for a date in milliliters (0 when nothing was logged). */
export async function getWaterTotalForDate(date: string): Promise<number> {
  const db = await getDatabase()
  const row = await db.getFirstAsync<{ total: number }>(
    "SELECT SUM(amount_ml) AS total FROM water_log WHERE date = ?",
    date,
  )
  return Number(row?.total ?? 0)
}

export async function addWaterEntry(input: {
  date: string
  amountMl: number
}): Promise<WaterEntry> {
  const db = await getDatabase()
  const entry: WaterEntry = {
    id: generateId(),
    date: input.date,
    amount_ml: input.amountMl,
    created_at: new Date().toISOString(),
  }
  await db.runAsync(
    `INSERT INTO water_log (id, date, amount_ml, created_at) VALUES (?, ?, ?, ?)`,
    entry.id,
    entry.date,
    entry.amount_ml,
    entry.created_at,
  )
  return entry
}

export async function deleteWaterEntry(id: string): Promise<void> {
  const db = await getDatabase()
  await db.runAsync("DELETE FROM water_log WHERE id = ?", id)
}
