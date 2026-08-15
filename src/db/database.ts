import * as SQLite from "expo-sqlite"
import { Platform } from "react-native"

/** Single in-flight open; avoids duplicate OPFS access handles on web (Strict Mode / parallel boot). */
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((error) => {
      dbPromise = null
      throw error
    })
  }
  return dbPromise
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync("dietinator.db", {
    useNewConnection: false,
  })
  await migrate(database)
  return database
}

export async function migrate(database: SQLite.SQLiteDatabase): Promise<void> {
  // WAL uses extra OPFS files; web OPFS allows only one sync handle per file.
  const journalMode = Platform.OS === "web" ? "DELETE" : "WAL"
  await database.execAsync(`
    PRAGMA journal_mode = ${journalMode};

    CREATE TABLE IF NOT EXISTS diary_entries (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      food_id TEXT,
      food_name TEXT NOT NULL,
      amount REAL NOT NULL,
      unit TEXT NOT NULL,
      kcal REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      created_at TEXT NOT NULL,
      yazio_synced INTEGER NOT NULL DEFAULT 0,
      yazio_item_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_diary_date ON diary_entries(date);
    CREATE INDEX IF NOT EXISTS idx_diary_yazio_item ON diary_entries(yazio_item_id);
    CREATE INDEX IF NOT EXISTS idx_diary_synced ON diary_entries(yazio_synced);
    CREATE INDEX IF NOT EXISTS idx_diary_food_id ON diary_entries(food_id);

    CREATE TABLE IF NOT EXISTS food_cache (
      yazio_product_id TEXT PRIMARY KEY NOT NULL,
      barcode TEXT,
      name TEXT NOT NULL,
      producer TEXT,
      nutrients_json TEXT NOT NULL,
      serving_json TEXT NOT NULL,
      servings_json TEXT,
      base_unit TEXT NOT NULL DEFAULT 'g',
      cached_at TEXT NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT,
      last_amount REAL,
      source TEXT
    );

    CREATE TABLE IF NOT EXISTS deleted_yazio_items (
      id TEXT PRIMARY KEY NOT NULL,
      deleted_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_food_barcode ON food_cache(barcode);
    CREATE INDEX IF NOT EXISTS idx_food_last_used ON food_cache(last_used_at DESC);

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      calorie_goal REAL NOT NULL DEFAULT 2000,
      protein_goal REAL NOT NULL DEFAULT 150,
      carbs_goal REAL NOT NULL DEFAULT 200,
      fat_goal REAL NOT NULL DEFAULT 65,
      units TEXT NOT NULL DEFAULT 'metric',
      yazio_sync_enabled INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS water_log (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      amount_ml REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_water_date ON water_log(date);

    INSERT OR IGNORE INTO settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS ai_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      reasoning TEXT NOT NULL DEFAULT '',
      tool_calls_json TEXT,
      tool_call_id TEXT,
      tool_name TEXT,
      is_error INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- Redundant index from an earlier schema: id is the rowid alias (already
    -- indexed by INTEGER PRIMARY KEY). Dropped for existing databases too.
    DROP INDEX IF EXISTS idx_ai_chat_created;

    CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_used_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_meals_last_used ON meals(last_used_at DESC);

    CREATE TABLE IF NOT EXISTS weight_entries (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL UNIQUE,
      weight_kg REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );

    -- Redundant index from an earlier schema: date is UNIQUE (auto-indexed).
    -- Dropped for existing databases too.
    DROP INDEX IF EXISTS idx_weight_date;

    CREATE TABLE IF NOT EXISTS meal_items (
      meal_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      producer TEXT,
      amount REAL NOT NULL,
      base_unit TEXT NOT NULL DEFAULT 'g',
      nutrients_json TEXT NOT NULL,
      serving_json TEXT NOT NULL,
      PRIMARY KEY (meal_id, position)
    );

    CREATE INDEX IF NOT EXISTS idx_meal_items_meal ON meal_items(meal_id);
  `)

  const settingsColumns = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(settings)",
  )
  if (!settingsColumns.some((column) => column.name === "food_database_country")) {
    await database.execAsync(
      `ALTER TABLE settings ADD COLUMN food_database_country TEXT NOT NULL DEFAULT ''`,
    )
  }
  if (!settingsColumns.some((column) => column.name === "update_check_enabled")) {
    await database.execAsync(
      `ALTER TABLE settings ADD COLUMN update_check_enabled INTEGER NOT NULL DEFAULT 1`,
    )
  }
  if (!settingsColumns.some((column) => column.name === "ai_enabled")) {
    await database.execAsync(
      `ALTER TABLE settings ADD COLUMN ai_enabled INTEGER NOT NULL DEFAULT 0`,
    )
  }
  if (!settingsColumns.some((column) => column.name === "ai_provider")) {
    await database.execAsync(
      `ALTER TABLE settings ADD COLUMN ai_provider TEXT NOT NULL DEFAULT 'openai'`,
    )
  }
  if (!settingsColumns.some((column) => column.name === "ai_base_url")) {
    await database.execAsync(`ALTER TABLE settings ADD COLUMN ai_base_url TEXT NOT NULL DEFAULT ''`)
  }
  if (!settingsColumns.some((column) => column.name === "ai_model")) {
    await database.execAsync(`ALTER TABLE settings ADD COLUMN ai_model TEXT NOT NULL DEFAULT ''`)
  }
  if (!settingsColumns.some((column) => column.name === "ai_system_prompt")) {
    await database.execAsync(
      `ALTER TABLE settings ADD COLUMN ai_system_prompt TEXT NOT NULL DEFAULT ''`,
    )
  }
  if (!settingsColumns.some((column) => column.name === "agent_bridge_rev")) {
    await database.execAsync(
      `ALTER TABLE settings ADD COLUMN agent_bridge_rev INTEGER NOT NULL DEFAULT 0`,
    )
  }
  if (!settingsColumns.some((column) => column.name === "theme_preference")) {
    await database.execAsync(
      `ALTER TABLE settings ADD COLUMN theme_preference TEXT NOT NULL DEFAULT 'system'`,
    )
  }
  if (!settingsColumns.some((column) => column.name === "water_goal_ml")) {
    await database.execAsync(
      `ALTER TABLE settings ADD COLUMN water_goal_ml REAL NOT NULL DEFAULT 2500`,
    )
  }
  if (!settingsColumns.some((column) => column.name === "height_cm")) {
    await database.execAsync(`ALTER TABLE settings ADD COLUMN height_cm REAL NOT NULL DEFAULT 0`)
  }
  if (!settingsColumns.some((column) => column.name === "target_weight_kg")) {
    await database.execAsync(
      `ALTER TABLE settings ADD COLUMN target_weight_kg REAL NOT NULL DEFAULT 0`,
    )
  }

  const foodCacheColumns = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(food_cache)",
  )
  if (!foodCacheColumns.some((column) => column.name === "base_unit")) {
    await database.execAsync(
      `ALTER TABLE food_cache ADD COLUMN base_unit TEXT NOT NULL DEFAULT 'g'`,
    )
  }
  if (!foodCacheColumns.some((column) => column.name === "source")) {
    // 'search' rows hold per-gram nutrients (never served cache-first);
    // 'detail' rows are normalized per 100 g/ml and are safe to serve locally.
    await database.execAsync(`ALTER TABLE food_cache ADD COLUMN source TEXT`)
  }
  if (!foodCacheColumns.some((column) => column.name === "servings_json")) {
    // All YAZIO serving options (cup, each, serving, whole, …) so the
    // add-food chips survive cache round-trips and offline use.
    await database.execAsync(`ALTER TABLE food_cache ADD COLUMN servings_json TEXT`)
  }
  if (!foodCacheColumns.some((column) => column.name === "last_amount")) {
    // Base-unit amount used the last time the food was logged — prefills the
    // add-food screen so repeat logging remembers the previous portion.
    await database.execAsync(`ALTER TABLE food_cache ADD COLUMN last_amount REAL`)
  }

  // One-time cleanup (user_version 0 → 1): drop cached foods whose stored
  // nutrients look per-gram (kcal < 10). They are either legacy raw per-gram
  // rows or rare normalized low-cal rows — both are ambiguous to read back, so
  // they get refetched and re-normalized from the API instead.
  const versionRow = await database.getFirstAsync<{ user_version: number }>("PRAGMA user_version")
  if ((versionRow?.user_version ?? 0) < 1) {
    await database.execAsync(
      `DELETE FROM food_cache
       WHERE base_unit IN ('g', 'ml')
         AND CAST(json_extract(nutrients_json, '$.kcal') AS REAL) < 10`,
    )
    await database.execAsync("PRAGMA user_version = 1")
  }
}
