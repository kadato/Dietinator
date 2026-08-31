import {
  getActiveAccountId,
  normalizeAccountId,
  setActiveAccountId,
} from "@/services/yazio/auth-storage"
import { clearAllUserData, clearDemoData, hasAnyUserData, hasDemoData } from "@/db/user-data"
import { clearYazioProfileCache } from "@/services/yazio/client"
import { clearImportCache } from "@/services/yazio/sync"
import { getDatabase } from "@/db/database"
import { deleteSecureItem, getSecureItem, setSecureItem } from "@/utils/secure-storage"

const SETTINGS_BACKUP_PREFIX = "account_settings_"
const API_KEY_BACKUP_PREFIX = "account_api_key_"

function settingsBackupKey(accountId: string): string {
  return `${SETTINGS_BACKUP_PREFIX}${accountId}`
}
function apiKeyBackupKey(accountId: string): string {
  return `${API_KEY_BACKUP_PREFIX}${accountId}`
}

async function backupCurrentAccountData(accountId: string): Promise<void> {
  if (!accountId || accountId === "demo") return
  try {
    const db = await getDatabase()
    const row = await db.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM settings WHERE id = 1",
    )
    if (row) {
      await setSecureItem(settingsBackupKey(accountId), JSON.stringify(row))
    }
    const apiKey = await getSecureItem("ai_api_key")
    if (apiKey) {
      await setSecureItem(apiKeyBackupKey(accountId), apiKey)
    }
  } catch {
    // Best-effort backup; never block switch.
  }
}

async function restoreAccountData(accountId: string): Promise<void> {
  if (!accountId || accountId === "demo") return
  try {
    const raw = await getSecureItem(settingsBackupKey(accountId))
    if (raw) {
      try {
        const saved = JSON.parse(raw) as Record<string, unknown>
        const db = await getDatabase()
        // Restore every column that exists in the current schema. Missing columns are ignored
        // by the UPDATE, extra columns from older backups are ignored.
        const cols = [
          "calorie_goal",
          "protein_goal",
          "carbs_goal",
          "fat_goal",
          "units",
          "yazio_sync_enabled",
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
        ] as const
        for (const col of cols) {
          if (saved[col] !== undefined) {
            await db.runAsync(
              `UPDATE settings SET ${col} = ? WHERE id = 1`,
              saved[col] as string | number,
            )
          }
        }
      } catch {}
    }
    const savedKey = await getSecureItem(apiKeyBackupKey(accountId))
    if (savedKey) {
      await setSecureItem("ai_api_key", savedKey)
    } else {
      await deleteSecureItem("ai_api_key")
    }
  } catch {}
}

/**
 * Ensure the SQLite store belongs to `newAccountId`.
 * If the active account differs, the previous user's diary, weight, water,
 * foods, meals, AI chats and every setting (goals, theme, AI provider/model,
 * api key) are isolated per account. Previous account's settings/api key are
 * backed up and the new account's are restored so switching back is lossless.
 * The first tracked login (no previous active id) also wipes any legacy
 * untracked data so demo data never leaks into a real YAZIO account.
 */
export async function ensureAccountDataIsolation(newAccountId: string): Promise<void> {
  const normalized = normalizeAccountId(newAccountId)
  const prev = await getActiveAccountId()
  let wiped = false
  if (prev) {
    if (prev !== normalized) {
      await backupCurrentAccountData(prev)
      await clearAllUserData()
      // New account must not see old account's api key. Delete global before restore.
      try {
        await deleteSecureItem("ai_api_key")
      } catch {}
      wiped = true
    }
  } else {
    // No tracking yet (upgrade or fresh install with legacy data). If any
    // per-user data exists it belongs to an unknown previous account, so
    // clear it before assigning the new one to avoid cross-account leakage.
    try {
      if (await hasAnyUserData()) {
        await clearAllUserData()
        try {
          await deleteSecureItem("ai_api_key")
        } catch {}
        wiped = true
      }
    } catch {
      // hasAnyUserData can fail if DB not yet migrated; treat as no data.
    }
  }
  if (wiped) {
    clearImportCache()
    clearYazioProfileCache()
    await restoreAccountData(normalized)
  }
  await setActiveAccountId(normalized)
}

/** Boot-time init: stamp the active account from existing auth without wiping. */
export async function initializeActiveAccountFromAuth(
  getCredentials: () => Promise<{ username: string } | null>,
  isLoggedIn: () => Promise<boolean>,
): Promise<void> {
  const existing = await getActiveAccountId()
  if (existing) return
  const loggedIn = await isLoggedIn()
  if (!loggedIn) return
  const creds = await getCredentials()
  if (creds?.username?.trim()) {
    await setActiveAccountId(normalizeAccountId(creds.username))
  } else {
    // Logged in without credentials is the demo account.
    await setActiveAccountId("demo")
  }
}

/** Heal installs that leaked demo data before per-user tracking existed. */
export async function healLeakedDemoDataIfNeeded(): Promise<void> {
  const active = await getActiveAccountId()
  if (!active || active === "demo") return
  try {
    if (await hasDemoData()) {
      await clearDemoData()
      // Demo polluted a subset of settings. Reset those to defaults so the real
      // account does not keep demo's goals, height or AI flag. Next YAZIO import
      // will restore the real goals.
      try {
        const db = await getDatabase()
        await db.runAsync(
          `UPDATE settings SET
            calorie_goal = 2000,
            protein_goal = 150,
            carbs_goal = 200,
            fat_goal = 65,
            water_goal_ml = 2500,
            height_cm = 0,
            target_weight_kg = 0,
            units = 'metric',
            yazio_sync_enabled = 0,
            ai_enabled = 0,
            ai_provider = 'openai',
            ai_model = ''
          WHERE id = 1`,
        )
        await deleteSecureItem("ai_api_key")
      } catch {}
      clearImportCache()
      clearYazioProfileCache()
    }
  } catch {
    // Best-effort healing; never block boot.
  }
}
