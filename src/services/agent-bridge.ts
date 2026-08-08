import * as diaryDb from "@/db/diary"
import { getSettings, updateSettings } from "@/db/settings"
import { listMeals, logMealToDiary, mealTotals } from "@/services/meals"
import type { DiaryEntry, FoodNutrients, MealType } from "@/types"
import { shiftDateKey, toDateKey } from "@/utils/date"

/**
 * Client half of the web "agent bridge".
 *
 * The web build pushes a small diary snapshot (recent days + goals) to the
 * Node server that serves it; the server's /mcp endpoint lets external AI
 * agents read that snapshot and enqueue changes (log/delete/set goals). This
 * module pushes snapshots after diary mutations and pulls + applies agent
 * changes back into SQLite. Native builds skip everything — the bridge is
 * strictly a web-host feature, and the diary always works without it.
 */

const AGENT_PREFIX = "/api/agent"
const SNAPSHOT_DAYS = 14

/** Web is the only target with a global window; native builds no-op. */
function isBridgeAvailable(): boolean {
  return typeof window !== "undefined" && typeof fetch !== "undefined"
}

export type AgentChange = {
  seq: number
  op: "log_food" | "delete_entry" | "set_goals" | "update_food_entry" | "set_units" | "log_meal"
  payload: Record<string, unknown>
  at: string
}

export type AgentChangeFeed = {
  changes: AgentChange[]
  revision: number
}

/** Push the current diary + goals to the web host (fire-and-forget). */
export async function pushSnapshot(): Promise<void> {
  if (!isBridgeAvailable()) return

  const today = toDateKey()
  const dates = Array.from({ length: SNAPSHOT_DAYS }, (_, index) =>
    shiftDateKey(today, index - (SNAPSHOT_DAYS - 1)),
  )
  const rows = (await Promise.all(dates.map((d) => diaryDb.getDiaryEntriesForDate(d)))).flat()
  const settings = await getSettings()

  const payload = {
    revision: settings.agent_bridge_rev,
    updated_at: new Date().toISOString(),
    settings: {
      calorie_goal: settings.calorie_goal,
      protein_goal: settings.protein_goal,
      carbs_goal: settings.carbs_goal,
      fat_goal: settings.fat_goal,
      units: settings.units,
      yazio_sync_enabled: settings.yazio_sync_enabled,
    },
    diary: rows.map((entry) => ({
      id: entry.id,
      date: entry.date,
      meal_type: entry.meal_type,
      food_name: entry.food_name,
      amount: entry.amount,
      unit: entry.unit,
      kcal: entry.kcal,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      created_at: entry.created_at,
    })),
    meals: (await listMeals()).map((meal) => {
      const totals = mealTotals(meal)
      return {
        id: meal.id,
        name: meal.name,
        kcal: Math.round(totals.kcal),
        protein: Math.round(totals.protein * 10) / 10,
        carbs: Math.round(totals.carbs * 10) / 10,
        fat: Math.round(totals.fat * 10) / 10,
        items_count: meal.items.length,
        last_used_at: meal.last_used_at ?? undefined,
      }
    }),
  }

  const response = await fetch(`${AGENT_PREFIX}/snapshot`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(`Snapshot rejected (HTTP ${response.status})`)
  }
}

/** Pull agent-made changes from the web host and apply them to SQLite. */
export async function pullAgentChanges(): Promise<void> {
  if (!isBridgeAvailable()) return

  const settings = await getSettings()
  let response: Response
  try {
    response = await fetch(`${AGENT_PREFIX}/changes?since=${settings.agent_bridge_rev}`)
  } catch {
    return // unreachable host — local-first diary keeps working
  }
  if (!response.ok) return

  let feed: AgentChangeFeed
  try {
    feed = (await response.json()) as AgentChangeFeed
  } catch {
    return
  }
  if (!Array.isArray(feed.changes)) return

  for (const change of feed.changes) {
    await applyChange(change)
  }
  const revision = Number(feed.revision)
  if (
    feed.changes.length > 0 &&
    Number.isFinite(revision) &&
    revision > settings.agent_bridge_rev
  ) {
    await updateSettings({ agent_bridge_rev: revision })
  }
}

export function applyChange(change: AgentChange): Promise<void> {
  switch (change.op) {
    case "log_food":
      return applyLogFood(change.payload)
    case "delete_entry":
      return applyDeleteEntry(change.payload)
    case "set_goals":
      return applySetGoals(change.payload)
    case "update_food_entry":
      return applyUpdateFoodEntry(change.payload)
    case "set_units":
      return applySetUnits(change.payload)
    case "log_meal":
      return applyLogMeal(change.payload)
    default:
      return Promise.resolve()
  }
}

function toDiaryEntry(payload: Record<string, unknown>): DiaryEntry | null {
  const name = typeof payload.food_name === "string" ? payload.food_name.trim() : ""
  const kcal = Number(payload.kcal)
  if (!name || !Number.isFinite(kcal) || kcal <= 0) return null
  const date = typeof payload.date === "string" ? payload.date : toDateKey()
  const mealType = ["breakfast", "lunch", "dinner", "snack"].includes(String(payload.meal_type))
    ? (payload.meal_type as MealType)
    : "snack"
  return {
    id: typeof payload.id === "string" ? payload.id : cryptoRandomId(),
    date,
    meal_type: mealType,
    food_id: null,
    food_name: name,
    amount: Number(payload.amount) > 0 ? Number(payload.amount) : 1,
    unit: typeof payload.unit === "string" ? payload.unit : "serving",
    kcal,
    protein: toNumber(payload.protein),
    carbs: toNumber(payload.carbs),
    fat: toNumber(payload.fat),
    created_at:
      typeof payload.created_at === "string" ? payload.created_at : new Date().toISOString(),
    yazio_synced: 0,
    yazio_item_id: null,
  }
}

async function applyLogFood(payload: Record<string, unknown>): Promise<void> {
  const entry = toDiaryEntry(payload)
  if (!entry) return
  const existing = await diaryDb.getDiaryEntryById(entry.id)
  if (existing) return
  await diaryDb.addDiaryEntry(entry)
}

async function applyDeleteEntry(payload: Record<string, unknown>): Promise<void> {
  const id = typeof payload.id === "string" ? payload.id : ""
  if (!id) return
  const existing = await diaryDb.getDiaryEntryById(id)
  if (!existing) return
  await diaryDb.removeDiaryEntry(id)
}

async function applySetGoals(payload: Record<string, unknown>): Promise<void> {
  const partial: Record<string, number> = {}
  const fields = ["calorie_goal", "protein_goal", "carbs_goal", "fat_goal"] as const
  for (const field of fields) {
    const value = payload[field]
    const num = Number(value)
    if (value !== undefined && value !== null && value !== "" && Number.isFinite(num) && num > 0) {
      partial[field] = num
    }
  }
  if (Object.keys(partial).length === 0) return
  await updateSettings(partial)
}

/** Amount/meal-slot edits scale the stored nutrients linearly (offline-safe). */
async function applyUpdateFoodEntry(payload: Record<string, unknown>): Promise<void> {
  const id = typeof payload.id === "string" ? payload.id : ""
  const amount = Number(payload.amount)
  if (!id || !Number.isFinite(amount) || amount <= 0) return
  const current = await diaryDb.getDiaryEntryById(id)
  if (!current || current.amount <= 0) return
  const mealType = ["breakfast", "lunch", "dinner", "snack"].includes(String(payload.meal_type))
    ? (payload.meal_type as MealType)
    : current.meal_type
  const factor = amount / current.amount
  const nutrients: FoodNutrients = {
    kcal: Math.round(current.kcal * factor),
    protein: Math.round(current.protein * factor * 10) / 10,
    carbs: Math.round(current.carbs * factor * 10) / 10,
    fat: Math.round(current.fat * factor * 10) / 10,
  }
  await diaryDb.updateDiaryEntryDetails(id, {
    amount,
    unit: current.unit,
    meal_type: mealType,
    food_name: current.food_name,
    nutrients,
  })
}

async function applySetUnits(payload: Record<string, unknown>): Promise<void> {
  const units =
    payload.units === "imperial" ? "imperial" : payload.units === "metric" ? "metric" : ""
  if (!units) return
  await updateSettings({ units })
}

async function applyLogMeal(payload: Record<string, unknown>): Promise<void> {
  const mealId = typeof payload.meal_id === "string" ? payload.meal_id : ""
  if (!mealId) return
  const meal = (await listMeals()).find((m) => m.id === mealId)
  if (!meal) return
  const date = typeof payload.date === "string" && payload.date ? payload.date : toDateKey()
  const mealType = ["breakfast", "lunch", "dinner", "snack"].includes(String(payload.meal_type))
    ? (payload.meal_type as MealType)
    : "snack"
  await logMealToDiary({ date, mealType, meal })
}

function toNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : 0
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
