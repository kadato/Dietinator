import type { AppSettings } from "@/types"
import { getDatabase } from "./database"

export async function getSettings(): Promise<AppSettings> {
  const db = await getDatabase()
  const row = await db.getFirstAsync<AppSettings>(
    "SELECT calorie_goal, protein_goal, carbs_goal, fat_goal, units, yazio_sync_enabled, food_database_country, update_check_enabled FROM settings WHERE id = 1",
  )
  return (
    row ?? {
      calorie_goal: 2000,
      protein_goal: 150,
      carbs_goal: 200,
      fat_goal: 65,
      units: "metric",
      yazio_sync_enabled: 0,
      food_database_country: "",
      update_check_enabled: 1,
    }
  )
}

export async function updateSettings(partial: Partial<AppSettings>): Promise<void> {
  const db = await getDatabase()
  const keys = Object.keys(partial) as (keyof AppSettings)[]
  if (keys.length === 0) return
  // Column-per-update avoids read-modify-write races between concurrent callers.
  await db.withTransactionAsync(async () => {
    for (const key of keys) {
      const value = partial[key]
      if (value === undefined) continue
      await db.runAsync(`UPDATE settings SET ${key} = ? WHERE id = 1`, value)
    }
  })
}
