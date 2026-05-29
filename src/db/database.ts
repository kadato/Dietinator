import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

/** Single in-flight open; avoids duplicate OPFS access handles on web (Strict Mode / parallel boot). */
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync('dietinator.db', {
    useNewConnection: false,
  });
  await migrate(database);
  return database;
}

async function migrate(database: SQLite.SQLiteDatabase): Promise<void> {
  // WAL uses extra OPFS files; web OPFS allows only one sync handle per file.
  const journalMode = Platform.OS === 'web' ? 'DELETE' : 'WAL';
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

    CREATE TABLE IF NOT EXISTS food_cache (
      yazio_product_id TEXT PRIMARY KEY NOT NULL,
      barcode TEXT,
      name TEXT NOT NULL,
      producer TEXT,
      nutrients_json TEXT NOT NULL,
      serving_json TEXT NOT NULL,
      cached_at TEXT NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT
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

    INSERT OR IGNORE INTO settings (id) VALUES (1);
  `);
}
