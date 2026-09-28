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
  ai_chat_messages?: Record<string, unknown>[]
}

function hasRequiredString(row: Record<string, unknown>, key: string): boolean {
  const value = row[key]
  return typeof value === "string" && value.length > 0
}

function validateBackupRows(payload: BackupPayload): void {
  for (const row of payload.diary_entries) {
    if (!hasRequiredString(row, "id") || !hasRequiredString(row, "date")) {
      throw new Error("Backup diary_entries rows must include id and date.")
    }
  }
  for (const row of payload.food_cache) {
    if (!hasRequiredString(row, "yazio_product_id")) {
      throw new Error("Backup food_cache rows must include yazio_product_id.")
    }
  }
  for (const row of payload.meals) {
    if (!hasRequiredString(row, "id") || !hasRequiredString(row, "name")) {
      throw new Error("Backup meals rows must include id and name.")
    }
  }
  for (const row of payload.meal_items) {
    if (!hasRequiredString(row, "meal_id") || !hasRequiredString(row, "product_id")) {
      throw new Error("Backup meal_items rows must include meal_id and product_id.")
    }
  }
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
  if (p.ai_chat_messages !== undefined && !Array.isArray(p.ai_chat_messages)) return false
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
    chatMessages,
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
    db.getAllAsync<Record<string, unknown>>("SELECT * FROM ai_chat_messages ORDER BY id"),
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
    ai_chat_messages: chatMessages,
  }
}

export type RestoreResult = {
  diaryEntries: number
  foodCache: number
  meals: number
  waterLogs?: number
  weightEntries?: number
  chatMessages?: number
}

/**
 * Replace all local data with a backup's contents, atomically. Returns counts
 * for the summary toast. Throws on invalid payloads or DB failures, so the
 * caller should surface the error and never partially apply a backup.
 */
export async function restoreBackup(payload: unknown): Promise<RestoreResult> {
  if (!isValidBackup(payload)) {
    throw new Error("This file is not a valid Dietinator backup.")
  }
  validateBackupRows(payload)

  const db = await getDatabase()
  let result: RestoreResult = {
    diaryEntries: 0,
    foodCache: 0,
    meals: 0,
    waterLogs: 0,
    weightEntries: 0,
    chatMessages: 0,
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
      DELETE FROM ai_chat_messages;
      DELETE FROM settings;
    `)

    if (payload.settings) {
      const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(settings)")
      const names = new Set(columns.map((c) => c.name))
      const entries = Object.entries(payload.settings).filter(
        ([key, value]) => key !== "id" && names.has(key) && value !== undefined,
      )
      if (entries.length > 0) {
        const cols = entries.map(([key]) => key).join(", ")
        const placeholders = entries.map(() => "?").join(", ")
        await db.runAsync(
          `INSERT INTO settings (id, ${cols}) VALUES (1, ${placeholders})`,
          ...entries.map(([, value]) => value as string | number | null),
        )
      } else {
        await db.runAsync(`INSERT INTO settings (id) VALUES (1)`)
      }
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

    if (payload.ai_chat_messages && Array.isArray(payload.ai_chat_messages)) {
      for (const row of payload.ai_chat_messages) {
        await db.runAsync(
          `INSERT OR REPLACE INTO ai_chat_messages (
            id, role, content, reasoning, tool_calls_json, tool_call_id, tool_name, is_error, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          row.id != null ? Number(row.id) : null,
          String(row.role ?? "user"),
          String(row.content ?? ""),
          String(row.reasoning ?? ""),
          row.tool_calls_json ? String(row.tool_calls_json) : null,
          row.tool_call_id ? String(row.tool_call_id) : null,
          row.tool_name ? String(row.tool_name) : null,
          row.is_error ? 1 : 0,
          String(row.created_at ?? new Date().toISOString()),
        )
      }
      result.chatMessages = payload.ai_chat_messages.length
    }
  })

  return result
}
