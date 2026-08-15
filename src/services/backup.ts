import { getDatabase } from "@/db/database"

/**
 * Full local-data backup: diary, food cache, settings, meals and YAZIO
 * tombstones, as one JSON document. Restore replaces the current data, so it
 * is offered with an explicit confirmation in the UI.
 */
export type BackupPayload = {
  app: "dietinator"
  version: 1
  exported_at: string
  settings: Record<string, unknown> | null
  diary_entries: Record<string, unknown>[]
  food_cache: Record<string, unknown>[]
  deleted_yazio_items: Record<string, unknown>[]
  meals: Record<string, unknown>[]
  meal_items: Record<string, unknown>[]
  water_log?: Record<string, unknown>[]
  weight_entries?: Record<string, unknown>[]
}

export function isValidBackup(payload: unknown): payload is BackupPayload {
  if (!payload || typeof payload !== "object") return false
  const p = payload as Record<string, unknown>
  if (p.app !== "dietinator" || p.version !== 1) return false
  const tables = [
    "diary_entries",
    "food_cache",
    "deleted_yazio_items",
    "meals",
    "meal_items",
  ] as const
  for (const table of tables) {
    if (!Array.isArray(p[table])) return false
  }
  if (p.water_log !== undefined && !Array.isArray(p.water_log)) return false
  if (p.weight_entries !== undefined && !Array.isArray(p.weight_entries)) return false
  if (p.settings !== null && typeof p.settings !== "object") return false
  return true
}

export async function createBackup(): Promise<BackupPayload> {
  const db = await getDatabase()
  const [
    settings,
    diaryEntries,
    foodCache,
    deletedItems,
    meals,
    mealItems,
    waterLogs,
    weightEntries,
  ] = await Promise.all([
    db.getFirstAsync<Record<string, unknown>>("SELECT * FROM settings WHERE id = 1"),
    db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM diary_entries ORDER BY date, created_at",
    ),
    db.getAllAsync<Record<string, unknown>>("SELECT * FROM food_cache ORDER BY yazio_product_id"),
    db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM deleted_yazio_items ORDER BY deleted_at",
    ),
    db.getAllAsync<Record<string, unknown>>("SELECT * FROM meals ORDER BY name"),
    db.getAllAsync<Record<string, unknown>>("SELECT * FROM meal_items ORDER BY meal_id, position"),
    db.getAllAsync<Record<string, unknown>>("SELECT * FROM water_log ORDER BY date, created_at"),
    db.getAllAsync<Record<string, unknown>>("SELECT * FROM weight_entries ORDER BY date"),
  ])
  return {
    app: "dietinator",
    version: 1,
    exported_at: new Date().toISOString(),
    settings: settings ?? null,
    diary_entries: diaryEntries,
    food_cache: foodCache,
    deleted_yazio_items: deletedItems,
    meals,
    meal_items: mealItems,
    water_log: waterLogs,
    weight_entries: weightEntries,
  }
}

export type RestoreResult = {
  diaryEntries: number
  foodCache: number
  meals: number
  waterLogs?: number
  weightEntries?: number
}

/**
 * Replace all local data with a backup's contents, atomically. Returns counts
 * for the summary toast. Throws on invalid payloads or DB failures — the
 * caller should surface the error and never partially apply a backup.
 */
export async function restoreBackup(payload: unknown): Promise<RestoreResult> {
  if (!isValidBackup(payload)) {
    throw new Error("This file is not a valid Dietinator backup.")
  }

  const db = await getDatabase()
  let result: RestoreResult = {
    diaryEntries: 0,
    foodCache: 0,
    meals: 0,
    waterLogs: 0,
    weightEntries: 0,
  }

  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM meal_items;
      DELETE FROM meals;
      DELETE FROM diary_entries;
      DELETE FROM food_cache;
      DELETE FROM deleted_yazio_items;
      DELETE FROM water_log;
      DELETE FROM weight_entries;
      DELETE FROM settings;
    `)

    if (payload.settings) {
      await db.runAsync(
        `INSERT INTO settings (
          id, calorie_goal, protein_goal, carbs_goal, fat_goal, units,
          yazio_sync_enabled, food_database_country, update_check_enabled,
          ai_enabled, ai_provider, ai_base_url, ai_model, ai_system_prompt,
          agent_bridge_rev, theme_preference, water_goal_ml, height_cm, target_weight_kg
        ) VALUES (
          1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )`,
        Number(payload.settings.calorie_goal ?? 2000),
        Number(payload.settings.protein_goal ?? 150),
        Number(payload.settings.carbs_goal ?? 200),
        Number(payload.settings.fat_goal ?? 65),
        String(payload.settings.units ?? "metric"),
        payload.settings.yazio_sync_enabled ? 1 : 0,
        String(payload.settings.food_database_country ?? ""),
        payload.settings.update_check_enabled === 0 ? 0 : 1,
        payload.settings.ai_enabled ? 1 : 0,
        String(payload.settings.ai_provider ?? "openai"),
        String(payload.settings.ai_base_url ?? ""),
        String(payload.settings.ai_model ?? ""),
        String(payload.settings.ai_system_prompt ?? ""),
        Number(payload.settings.agent_bridge_rev ?? 0),
        String(payload.settings.theme_preference ?? "system"),
        Number(payload.settings.water_goal_ml ?? 2500),
        Number(payload.settings.height_cm ?? 0),
        Number(payload.settings.target_weight_kg ?? 0),
      )
    } else {
      await db.runAsync(`INSERT INTO settings (id) VALUES (1)`)
    }

    for (const row of payload.diary_entries) {
      await db.runAsync(
        `INSERT OR REPLACE INTO diary_entries (
          id, date, meal_type, food_id, food_name, amount, unit,
          kcal, protein, carbs, fat, created_at, yazio_synced, yazio_item_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        String(row.id),
        String(row.date),
        String(row.meal_type),
        row.food_id ? String(row.food_id) : null,
        String(row.food_name),
        Number(row.amount ?? 0),
        String(row.unit ?? "g"),
        Number(row.kcal ?? 0),
        Number(row.protein ?? 0),
        Number(row.carbs ?? 0),
        Number(row.fat ?? 0),
        String(row.created_at ?? new Date().toISOString()),
        row.yazio_synced ? 1 : 0,
        row.yazio_item_id ? String(row.yazio_item_id) : null,
      )
    }
    result.diaryEntries = payload.diary_entries.length

    for (const row of payload.food_cache) {
      await db.runAsync(
        `INSERT OR REPLACE INTO food_cache (
          yazio_product_id, barcode, name, producer, nutrients_json, serving_json, servings_json,
          base_unit, cached_at, is_favorite, last_used_at, last_amount, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        String(row.yazio_product_id),
        row.barcode ? String(row.barcode) : null,
        String(row.name),
        row.producer ? String(row.producer) : null,
        String(row.nutrients_json ?? "{}"),
        String(row.serving_json ?? "{}"),
        row.servings_json ? String(row.servings_json) : null,
        String(row.base_unit ?? "g"),
        String(row.cached_at ?? new Date().toISOString()),
        row.is_favorite ? 1 : 0,
        row.last_used_at ? String(row.last_used_at) : null,
        row.last_amount != null ? Number(row.last_amount) : null,
        row.source ? String(row.source) : null,
      )
    }
    result.foodCache = payload.food_cache.length

    for (const row of payload.deleted_yazio_items) {
      await db.runAsync(
        `INSERT OR IGNORE INTO deleted_yazio_items (id, deleted_at) VALUES (?, ?)`,
        String(row.id),
        String(row.deleted_at ?? new Date().toISOString()),
      )
    }

    for (const row of payload.meals) {
      await db.runAsync(
        `INSERT OR REPLACE INTO meals (id, name, created_at, updated_at, last_used_at) VALUES (?, ?, ?, ?, ?)`,
        String(row.id),
        String(row.name),
        String(row.created_at ?? new Date().toISOString()),
        String(row.updated_at ?? new Date().toISOString()),
        row.last_used_at ? String(row.last_used_at) : null,
      )
    }
    result.meals = payload.meals.length

    for (const row of payload.meal_items) {
      await db.runAsync(
        `INSERT OR REPLACE INTO meal_items (
          meal_id, position, product_id, name, producer, amount, base_unit,
          nutrients_json, serving_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        String(row.meal_id),
        Number(row.position ?? 0),
        String(row.product_id),
        String(row.name),
        row.producer ? String(row.producer) : null,
        Number(row.amount ?? 0),
        String(row.base_unit ?? "g"),
        String(row.nutrients_json ?? "{}"),
        String(row.serving_json ?? "{}"),
      )
    }

    if (payload.water_log && Array.isArray(payload.water_log)) {
      for (const row of payload.water_log) {
        await db.runAsync(
          `INSERT OR REPLACE INTO water_log (id, date, amount_ml, created_at) VALUES (?, ?, ?, ?)`,
          String(row.id),
          String(row.date),
          Number(row.amount_ml ?? 0),
          String(row.created_at ?? new Date().toISOString()),
        )
      }
      result.waterLogs = payload.water_log.length
    }

    if (payload.weight_entries && Array.isArray(payload.weight_entries)) {
      for (const row of payload.weight_entries) {
        await db.runAsync(
          `INSERT OR REPLACE INTO weight_entries (id, date, weight_kg, note, created_at) VALUES (?, ?, ?, ?, ?)`,
          String(row.id),
          String(row.date),
          Number(row.weight_kg ?? 0),
          row.note ? String(row.note) : null,
          String(row.created_at ?? new Date().toISOString()),
        )
      }
      result.weightEntries = payload.weight_entries.length
    }
  })

  return result
}
