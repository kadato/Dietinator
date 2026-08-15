import { getDatabase } from "./database"

export type DailyKcal = { date: string; kcal: number }
export type DailyNutrition = {
  date: string
  kcal: number
  protein: number
  carbs: number
  fat: number
}

/** Per-day nutrition totals (calories + macros) from the diary in a single query. */
export async function getDailyNutritionHistory(fromDateKey: string): Promise<DailyNutrition[]> {
  const db = await getDatabase()
  return db.getAllAsync<DailyNutrition>(
    `SELECT date,
       SUM(kcal) AS kcal,
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

export type DailyWater = { date: string; ml: number }

/** Per-day water totals from the water log, oldest first, from `fromDateKey` on. */
export async function getWaterHistory(fromDateKey: string): Promise<DailyWater[]> {
  const db = await getDatabase()
  return db.getAllAsync<DailyWater>(
    `SELECT date, SUM(amount_ml) AS ml
     FROM water_log
     WHERE date >= ?
     GROUP BY date
     ORDER BY date ASC`,
    [fromDateKey],
  )
}
