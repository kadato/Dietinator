import { getDatabase } from "./database"

export type DailyKcal = { date: string; kcal: number }

/** Per-day calorie totals from the diary, oldest first, from `fromDateKey` on. */
export async function getCalorieHistory(fromDateKey: string): Promise<DailyKcal[]> {
  const db = await getDatabase()
  return db.getAllAsync<DailyKcal>(
    `SELECT date, SUM(kcal) AS kcal
     FROM diary_entries
     WHERE date >= ?
     GROUP BY date
     ORDER BY date ASC`,
    [fromDateKey],
  )
}

export type DailyMacros = { date: string; protein: number; carbs: number; fat: number }

/** Per-day macro totals from the diary, oldest first, from `fromDateKey` on. */
export async function getMacroHistory(fromDateKey: string): Promise<DailyMacros[]> {
  const db = await getDatabase()
  return db.getAllAsync<DailyMacros>(
    `SELECT date,
       SUM(protein) AS protein,
       SUM(carbs) AS carbs,
       SUM(fat) AS fat
     FROM diary_entries
     WHERE date >= ?
     GROUP BY date
     ORDER BY date ASC`,
    [fromDateKey],
  )
}
