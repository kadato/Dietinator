import * as diaryDb from "@/db/diary"
import { getSettings, updateSettings } from "@/db/settings"
import * as waterDb from "@/db/water"
import * as weightDb from "@/db/weight"
import * as mealsDb from "@/db/meals"
import { getFavoriteFoods, toggleFavorite } from "@/db/food-cache"
import { listMeals, logMealToDiary, mealTotals } from "@/services/meals"
import type { DiaryEntry, FoodNutrients, MealItem, MealType } from "@/types"
import { shiftDateKey, toDateKey } from "@/utils/date"

/**
 * Client half of the web "agent bridge".
 *
 * The web build pushes a snapshot (recent diary, water, weight, meals, favorites, goals)
 * to the Node server that serves it; the server's /mcp endpoint lets external AI
 * agents read that snapshot and enqueue changes. This module pushes snapshots
 * after mutations and pulls + applies agent changes back into SQLite.
 */

const AGENT_PREFIX = "/api/agent"
const SNAPSHOT_DAYS = 14

/** Web is the only target with a global window; native builds no-op. */
function isBridgeAvailable(): boolean {
  return typeof window !== "undefined" && typeof fetch !== "undefined"
}

export type AgentChange = {
  seq: number
  op:
    | "log_food"
    | "delete_entry"
    | "set_goals"
    | "update_food_entry"
    | "set_units"
    | "log_meal"
    | "save_meal"
    | "delete_meal"
    | "log_water"
    | "delete_water"
    | "log_weight"
    | "delete_weight"
    | "toggle_favorite"
    | "set_profile"
  payload: Record<string, unknown>
  at: string
}

export type AgentChangeFeed = {
  changes: AgentChange[]
  revision: number
}

/** Push the current app data to the web host (fire-and-forget). */
export async function pushSnapshot(): Promise<void> {
  if (!isBridgeAvailable()) return

  const today = toDateKey()
  const dates = Array.from({ length: SNAPSHOT_DAYS }, (_, index) =>
    shiftDateKey(today, index - (SNAPSHOT_DAYS - 1)),
  )
  const fromDate = dates[0]

  const [diaryRows, waterRows, weightRows, favorites, settings, meals] = await Promise.all([
    Promise.all(dates.map((d) => diaryDb.getDiaryEntriesForDate(d))).then((res) => res.flat()),
    Promise.all(dates.map((d) => waterDb.getWaterEntriesForDate(d))).then((res) => res.flat()),
    weightDb.getWeightEntries(fromDate),
    getFavoriteFoods(),
    getSettings(),
    listMeals(),
  ])

  const payload = {
    revision: settings.agent_bridge_rev,
    updated_at: new Date().toISOString(),
    settings: {
      calorie_goal: settings.calorie_goal,
      protein_goal: settings.protein_goal,
      carbs_goal: settings.carbs_goal,
      fat_goal: settings.fat_goal,
      water_goal_ml: settings.water_goal_ml || 2500,
      height_cm: settings.height_cm,
      target_weight_kg: settings.target_weight_kg,
      units: settings.units,
      food_database_country: settings.food_database_country,
      theme_preference: settings.theme_preference,
      yazio_sync_enabled: settings.yazio_sync_enabled,
      update_check_enabled: settings.update_check_enabled,
      ai_enabled: settings.ai_enabled,
    },
    diary: diaryRows.map((entry) => ({
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
    water: waterRows.map((entry) => ({
      id: entry.id,
      date: entry.date,
      amount_ml: entry.amount_ml,
      created_at: entry.created_at,
    })),
    weight: weightRows.map((entry) => ({
      id: entry.id,
      date: entry.date,
      weight_kg: entry.weight_kg,
      note: entry.note,
      created_at: entry.created_at,
    })),
    favorites: favorites.map((food) => ({
      product_id: food.product_id,
      name: food.name,
      producer: food.producer,
      nutrients: food.nutrients,
      base_unit: food.base_unit,
    })),
    meals: meals.map((meal) => {
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
        items: meal.items.map((item) => ({
          product_id: item.product_id,
          name: item.name,
          producer: item.producer,
          amount: item.amount,
          base_unit: item.base_unit,
          nutrients: item.nutrients,
        })),
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
    return // unreachable host, and the local-first diary keeps working
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
    case "save_meal":
      return applySaveMeal(change.payload)
    case "delete_meal":
      return applyDeleteMeal(change.payload)
    case "log_water":
      return applyLogWater(change.payload)
    case "delete_water":
      return applyDeleteWater(change.payload)
    case "log_weight":
      return applyLogWeight(change.payload)
    case "delete_weight":
      return applyDeleteWeight(change.payload)
    case "toggle_favorite":
      return applyToggleFavorite(change.payload)
    case "set_profile":
      return applySetProfile(change.payload)
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
  const fields = [
    "calorie_goal",
    "protein_goal",
    "carbs_goal",
    "fat_goal",
    "water_goal_ml",
    "target_weight_kg",
  ] as const
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

async function applySaveMeal(payload: Record<string, unknown>): Promise<void> {
  const name = typeof payload.name === "string" ? payload.name.trim() : ""
  if (!name) return
  const rawItems = Array.isArray(payload.items) ? payload.items : []
  if (rawItems.length === 0) return
  const items: MealItem[] = []
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue
    const itemObj = raw as Record<string, unknown>
    const itemName = typeof itemObj.name === "string" ? itemObj.name.trim() : ""
    if (!itemName) continue
    const amount = Number(itemObj.amount) > 0 ? Number(itemObj.amount) : 100
    const baseUnit = typeof itemObj.base_unit === "string" ? itemObj.base_unit : "g"
    const kcal = Number(itemObj.kcal) > 0 ? Number(itemObj.kcal) : 0
    const protein = toNumber(itemObj.protein)
    const carbs = toNumber(itemObj.carbs)
    const fat = toNumber(itemObj.fat)
    items.push({
      product_id:
        typeof itemObj.product_id === "string" && itemObj.product_id
          ? itemObj.product_id
          : cryptoRandomId(),
      name: itemName,
      producer: typeof itemObj.producer === "string" ? itemObj.producer : "",
      amount,
      base_unit: baseUnit,
      nutrients: { kcal, protein, carbs, fat },
      serving: { serving: `${amount} ${baseUnit}`, amount, serving_quantity: amount },
    })
  }
  if (items.length === 0) return
  const id = typeof payload.id === "string" && payload.id ? payload.id : cryptoRandomId()
  const now = new Date().toISOString()
  await mealsDb.saveMeal({
    id,
    name,
    created_at: now,
    updated_at: now,
    items,
  })
}

async function applyDeleteMeal(payload: Record<string, unknown>): Promise<void> {
  const id = typeof payload.id === "string" ? payload.id : ""
  if (!id) return
  await mealsDb.deleteMeal(id)
}

async function applyLogWater(payload: Record<string, unknown>): Promise<void> {
  const amount = Number(payload.amount_ml)
  if (!Number.isFinite(amount) || amount <= 0) return
  const date = typeof payload.date === "string" ? payload.date : toDateKey()
  await waterDb.addWaterEntry({ date, amountMl: Math.round(amount) })
}

async function applyDeleteWater(payload: Record<string, unknown>): Promise<void> {
  const id = typeof payload.id === "string" ? payload.id : ""
  if (!id) return
  await waterDb.deleteWaterEntry(id)
}

async function applyLogWeight(payload: Record<string, unknown>): Promise<void> {
  const weightKg = Number(payload.weight_kg)
  if (!Number.isFinite(weightKg) || weightKg <= 0) return
  const date = typeof payload.date === "string" ? payload.date : toDateKey()
  const note = typeof payload.note === "string" ? payload.note.trim() : undefined
  await weightDb.saveWeightEntry({ date, weightKg: Math.round(weightKg * 100) / 100, note })
}

async function applyDeleteWeight(payload: Record<string, unknown>): Promise<void> {
  const id = typeof payload.id === "string" ? payload.id : ""
  if (!id) return
  await weightDb.deleteWeightEntry(id)
}

async function applyToggleFavorite(payload: Record<string, unknown>): Promise<void> {
  const productId = typeof payload.product_id === "string" ? payload.product_id : ""
  if (!productId) return
  await toggleFavorite(productId)
}

async function applySetProfile(payload: Record<string, unknown>): Promise<void> {
  const update: Record<string, unknown> = {}
  if (payload.height_cm !== undefined && Number(payload.height_cm) > 0) {
    update.height_cm = Number(payload.height_cm)
  }
  if (payload.target_weight_kg !== undefined && Number(payload.target_weight_kg) > 0) {
    update.target_weight_kg = Number(payload.target_weight_kg)
  }
  if (payload.water_goal_ml !== undefined && Number(payload.water_goal_ml) > 0) {
    update.water_goal_ml = Number(payload.water_goal_ml)
  }
  if (typeof payload.food_database_country === "string") {
    update.food_database_country = payload.food_database_country.trim().toUpperCase()
  }
  if (
    payload.theme_preference === "system" ||
    payload.theme_preference === "light" ||
    payload.theme_preference === "dark"
  ) {
    update.theme_preference = payload.theme_preference
  }
  if (payload.units === "metric" || payload.units === "imperial") {
    update.units = payload.units
  }
  if (Object.keys(update).length === 0) return
  await updateSettings(update as Parameters<typeof updateSettings>[0])
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
