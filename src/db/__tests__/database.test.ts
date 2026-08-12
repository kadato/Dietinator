import { migrate } from "../database"
import type { SQLiteDatabase } from "expo-sqlite"

/**
 * Migration tests run against a recording mock database. They pin the schema
 * contract: every CREATE/ALTER statement the app ships, in order, plus the
 * one-time user_version 0 → 1 cache cleanup.
 */
type MockDb = {
  execAsync: jest.Mock
  getAllAsync: jest.Mock
  getFirstAsync: jest.Mock
  sql: string[]
  schemaSql: string
  alters: string[]
}

function createMockDb(options: {
  userVersion: number
  columns?: Record<string, string[]>
}): MockDb {
  const db = {
    sql: [] as string[],
    alters: [] as string[],
    execAsync: jest.fn(async (sql: string) => {
      db.sql.push(sql)
      for (const match of sql.matchAll(/ALTER TABLE (\w+) ADD COLUMN (\w+)/g)) {
        db.alters.push(`${match[1]}.${match[2]}`)
      }
    }),
    getAllAsync: jest.fn(async (query: string) => {
      if (query.includes("table_info(settings)")) {
        return (
          options.columns?.settings ?? [
            "food_database_country",
            "update_check_enabled",
            "ai_enabled",
            "ai_provider",
            "ai_base_url",
            "ai_model",
            "ai_system_prompt",
            "agent_bridge_rev",
            "theme_preference",
            "water_goal_ml",
            "height_cm",
            "target_weight_kg",
          ]
        ).map((name) => ({ name }))
      }
      if (query.includes("table_info(food_cache)")) {
        return (
          options.columns?.food_cache ?? ["base_unit", "source", "servings_json", "last_amount"]
        ).map((name) => ({ name }))
      }
      return []
    }),
    getFirstAsync: jest.fn(async () => ({ user_version: options.userVersion })),
  } as unknown as MockDb
  Object.defineProperty(db, "schemaSql", {
    get: () => db.sql[0] ?? "",
  })
  return db
}

describe("migrate", () => {
  it("creates every table and index in one statement", async () => {
    const db = createMockDb({ userVersion: 1 })
    await migrate(db as unknown as SQLiteDatabase)

    expect(db.sql[0]).toContain("CREATE TABLE IF NOT EXISTS diary_entries")
    expect(db.sql[0]).toContain("CREATE TABLE IF NOT EXISTS food_cache")
    expect(db.sql[0]).toContain("CREATE TABLE IF NOT EXISTS deleted_yazio_items")
    expect(db.sql[0]).toContain("CREATE TABLE IF NOT EXISTS settings")
    expect(db.sql[0]).toContain("CREATE TABLE IF NOT EXISTS water_log")
    expect(db.sql[0]).toContain("CREATE TABLE IF NOT EXISTS meals")
    expect(db.sql[0]).toContain("CREATE TABLE IF NOT EXISTS meal_items")
    expect(db.sql[0]).toContain("CREATE INDEX IF NOT EXISTS idx_diary_date")
    expect(db.sql[0]).toContain("CREATE INDEX IF NOT EXISTS idx_food_barcode")
    expect(db.sql[0]).toContain("CREATE INDEX IF NOT EXISTS idx_meals_last_used")
  })

  it("sets WAL journal mode on native platforms", async () => {
    const db = createMockDb({ userVersion: 1 })
    await migrate(db as unknown as SQLiteDatabase)
    expect(db.sql[0]).toContain("PRAGMA journal_mode = WAL")
  })

  it("adds missing settings and food_cache columns", async () => {
    const db = createMockDb({
      userVersion: 1,
      columns: { settings: [], food_cache: [] },
    })
    await migrate(db as unknown as SQLiteDatabase)
    expect(db.alters).toEqual(
      expect.arrayContaining([
        "settings.food_database_country",
        "settings.update_check_enabled",
        "settings.ai_enabled",
        "settings.ai_provider",
        "settings.ai_base_url",
        "settings.ai_model",
        "settings.ai_system_prompt",
        "settings.agent_bridge_rev",
        "settings.theme_preference",
        "settings.water_goal_ml",
        "settings.height_cm",
        "settings.target_weight_kg",
        "food_cache.base_unit",
        "food_cache.source",
        "food_cache.servings_json",
      ]),
    )
  })

  it("skips columns that already exist", async () => {
    const db = createMockDb({ userVersion: 1 })
    await migrate(db as unknown as SQLiteDatabase)
    expect(db.alters).toEqual([])
  })

  it("runs the one-time per-gram cache cleanup for user_version 0 and bumps to 1", async () => {
    const db = createMockDb({ userVersion: 0 })
    await migrate(db as unknown as SQLiteDatabase)

    const cleanup = db.sql.find((sql) => sql.includes("json_extract(nutrients_json"))
    expect(cleanup).toBeDefined()
    expect(cleanup).toContain("DELETE FROM food_cache")
    expect(db.sql).toContain("PRAGMA user_version = 1")
  })

  it("skips the cleanup for fresh or bumped databases", async () => {
    const db = createMockDb({ userVersion: 1 })
    await migrate(db as unknown as SQLiteDatabase)
    expect(db.sql.some((sql) => sql.includes("json_extract(nutrients_json"))).toBe(false)
  })
})
