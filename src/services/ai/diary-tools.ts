import * as diaryDb from "@/db/diary"
import { getSettings, updateSettings } from "@/db/settings"
import * as waterDb from "@/db/water"
import * as weightDb from "@/db/weight"
import * as mealsDb from "@/db/meals"
import {
  getFavoriteFoods,
  getRecentFoodUsages,
  searchLocalFoods,
  toggleFavorite,
} from "@/db/food-cache"
import { searchFoodsRemote } from "@/services/yazio/foods"
import { updateDiaryEntry as updateDiaryEntryService } from "@/services/diary"
import { listMeals, logMealToDiary, mealTotals } from "@/services/meals"
import type { DiaryEntry, MealItem, MealType, SearchFoodResult } from "@/types"
import { generateId } from "@/utils/id"
import { shiftDateKey, toDateKey } from "@/utils/date"
import { MEAL_LABELS } from "@/utils/meals"
import { numberSchema, stringSchema, type AiToolDefinition } from "./tools"

/**
 * Tools the in-app assistant can call. They run on-device against SQLite,
 * so chat works offline; the same capability surface is exposed to external
 * agents over the web server's /mcp endpoint (via the snapshot bridge).
 */

type DiaryRow = {
  id: string
  meal_type: MealType
  food_name: string
  amount: number
  unit: string
  kcal: number
  protein: number
  carbs: number
  fat: number
}

function rowToDiaryRow(entry: DiaryEntry): DiaryRow {
  return {
    id: entry.id,
    meal_type: entry.meal_type,
    food_name: entry.food_name,
    amount: entry.amount,
    unit: entry.unit,
    kcal: Math.round(entry.kcal),
    protein: Math.round(entry.protein * 10) / 10,
    carbs: Math.round(entry.carbs * 10) / 10,
    fat: Math.round(entry.fat * 10) / 10,
  }
}

function isMealType(value: unknown): value is MealType {
  return value === "breakfast" || value === "lunch" || value === "dinner" || value === "snack"
}

export function summarizeEntries(entries: DiaryEntry[]): {
  entries: DiaryRow[]
  totals: { kcal: number; protein: number; carbs: number; fat: number }
} {
  const totals = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
  return {
    entries: entries.map(rowToDiaryRow),
    totals: {
      kcal: Math.round(totals.kcal),
      protein: Math.round(totals.protein * 10) / 10,
      carbs: Math.round(totals.carbs * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
    },
  }
}

function toPositiveNumber(value: unknown, fallback: number): number {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : fallback
}

// Diary tools

async function getDiarySummaryTool(args: Record<string, unknown>): Promise<unknown> {
  const date = typeof args.date === "string" && args.date ? args.date : toDateKey()
  const entries = await diaryDb.getDiaryEntriesForDate(date)
  const summary = summarizeEntries(entries)
  const [settings, totalEntries] = await Promise.all([getSettings(), diaryDb.getDiaryEntryCount()])
  return {
    success: true,
    date,
    ...summary,
    goals: {
      calorie_goal: settings.calorie_goal,
      protein_goal: settings.protein_goal,
      carbs_goal: settings.carbs_goal,
      fat_goal: settings.fat_goal,
    },
    total_entries_in_diary: totalEntries,
  }
}

async function logFoodTool(args: Record<string, unknown>): Promise<unknown> {
  const date = typeof args.date === "string" && args.date ? args.date : toDateKey()
  const mealType = isMealType(args.meal_type) ? args.meal_type : "snack"
  const name = typeof args.name === "string" ? args.name.trim() : ""
  if (!name) {
    return { success: false, error: "Provide a food name to log." }
  }

  const kcal = toPositiveNumber(args.kcal, 0)
  if (kcal <= 0) {
    return { success: false, error: "Provide a positive kcal value." }
  }

  const entry: DiaryEntry = {
    id: generateId(),
    date,
    meal_type: mealType,
    food_id: null,
    food_name: name,
    amount: 1,
    unit: "serving",
    kcal,
    protein: toPositiveNumber(args.protein, 0),
    carbs: toPositiveNumber(args.carbs, 0),
    fat: toPositiveNumber(args.fat, 0),
    created_at: new Date().toISOString(),
    yazio_synced: 0,
    yazio_item_id: null,
  }
  await diaryDb.addDiaryEntry(entry)
  return { success: true, entry: rowToDiaryRow(entry), meal: MEAL_LABELS[mealType] }
}

async function updateFoodEntryTool(args: Record<string, unknown>): Promise<unknown> {
  const id = typeof args.entry_id === "string" ? args.entry_id : ""
  if (!id) {
    return { success: false, error: "Provide the entry_id to update." }
  }
  const amount = Number(args.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Provide a positive amount." }
  }
  const current = await diaryDb.getDiaryEntryById(id)
  if (!current) {
    return { success: false, error: `No diary entry with id '${id}'.` }
  }
  const mealType = isMealType(args.meal_type) ? args.meal_type : current.meal_type
  const updated = await updateDiaryEntryService({ id, amount, mealType })
  if (!updated) {
    return { success: false, error: `No diary entry with id '${id}'.` }
  }
  return { success: true, entry: rowToDiaryRow(updated) }
}

async function deleteFoodEntryTool(args: Record<string, unknown>): Promise<unknown> {
  const id = typeof args.entry_id === "string" ? args.entry_id : ""
  if (!id) {
    return { success: false, error: "Provide the entry_id to delete." }
  }
  const existing = await diaryDb.getDiaryEntryById(id)
  if (!existing) {
    return { success: false, error: `No diary entry with id '${id}'.` }
  }
  await diaryDb.removeDiaryEntry(id)
  return { success: true, deleted: { id, food_name: existing.food_name } }
}

async function getDiaryStatsTool(args: Record<string, unknown>): Promise<unknown> {
  const days = Math.min(Math.max(Number(args.days) || 7, 1), 30)
  const today = toDateKey()
  const rows: { date: string; kcal: number; protein: number; carbs: number; fat: number }[] = []
  let daysLogged = 0
  for (let index = days - 1; index >= 0; index--) {
    const date = shiftDateKey(today, -index)
    const entries = await diaryDb.getDiaryEntriesForDate(date)
    if (entries.length > 0) daysLogged += 1
    const totals = entries.reduce(
      (acc, e) => ({
        kcal: acc.kcal + e.kcal,
        protein: acc.protein + e.protein,
        carbs: acc.carbs + e.carbs,
        fat: acc.fat + e.fat,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    )
    rows.push({
      date,
      kcal: Math.round(totals.kcal),
      protein: Math.round(totals.protein * 10) / 10,
      carbs: Math.round(totals.carbs * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
    })
  }
  return { success: true, days_count: days, days_logged: daysLogged, days: rows }
}

// Water tools

async function getWaterTool(args: Record<string, unknown>): Promise<unknown> {
  const date = typeof args.date === "string" && args.date ? args.date : toDateKey()
  const [entries, total, settings] = await Promise.all([
    waterDb.getWaterEntriesForDate(date),
    waterDb.getWaterTotalForDate(date),
    getSettings(),
  ])
  const goal = settings.water_goal_ml || 2500
  const progressPercent = goal > 0 ? Math.min(Math.round((total / goal) * 100), 999) : 0
  return {
    success: true,
    date,
    total_ml: total,
    goal_ml: goal,
    progress_percent: progressPercent,
    entries: entries.map((e) => ({
      id: e.id,
      amount_ml: e.amount_ml,
      created_at: e.created_at,
    })),
  }
}

async function logWaterTool(args: Record<string, unknown>): Promise<unknown> {
  const amount = Number(args.amount_ml)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Provide a positive amount_ml value in milliliters." }
  }
  const date = typeof args.date === "string" && args.date ? args.date : toDateKey()
  const entry = await waterDb.addWaterEntry({ date, amountMl: Math.round(amount) })
  const [total, settings] = await Promise.all([waterDb.getWaterTotalForDate(date), getSettings()])
  return {
    success: true,
    entry,
    total_ml: total,
    goal_ml: settings.water_goal_ml || 2500,
  }
}

async function deleteWaterEntryTool(args: Record<string, unknown>): Promise<unknown> {
  const id = typeof args.entry_id === "string" ? args.entry_id : ""
  if (!id) {
    return { success: false, error: "Provide the entry_id to delete." }
  }
  await waterDb.deleteWaterEntry(id)
  return { success: true, deleted: { id } }
}

// Weight and body metrics tools

async function getWeightTool(args: Record<string, unknown>): Promise<unknown> {
  const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 30)
  const [entries, settings] = await Promise.all([
    weightDb.getRecentWeightEntries(limit),
    getSettings(),
  ])
  const latest = entries[0] ?? null
  const heightCm = settings.height_cm || 0
  const targetWeightKg = settings.target_weight_kg || 0
  let bmi: number | null = null
  if (latest && heightCm > 0) {
    const heightM = heightCm / 100
    bmi = Math.round((latest.weight_kg / (heightM * heightM)) * 10) / 10
  }
  let deltaFromPrevious: number | null = null
  if (entries.length >= 2) {
    deltaFromPrevious = Math.round((entries[0].weight_kg - entries[1].weight_kg) * 100) / 100
  }
  return {
    success: true,
    units: settings.units,
    height_cm: heightCm || undefined,
    target_weight_kg: targetWeightKg || undefined,
    latest_weight: latest
      ? {
          date: latest.date,
          weight_kg: latest.weight_kg,
          note: latest.note ?? undefined,
          bmi: bmi ?? undefined,
          delta_from_previous_kg: deltaFromPrevious ?? undefined,
        }
      : null,
    entries: entries.map((e) => ({
      id: e.id,
      date: e.date,
      weight_kg: e.weight_kg,
      note: e.note ?? undefined,
      created_at: e.created_at,
    })),
  }
}

async function logWeightTool(args: Record<string, unknown>): Promise<unknown> {
  const weightKg = Number(args.weight_kg)
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return { success: false, error: "Provide a positive weight_kg value in kilograms." }
  }
  const date = typeof args.date === "string" && args.date ? args.date : toDateKey()
  const note = typeof args.note === "string" ? args.note.trim() : undefined
  await weightDb.saveWeightEntry({ date, weightKg: Math.round(weightKg * 100) / 100, note })
  const settings = await getSettings()
  let bmi: number | null = null
  if (settings.height_cm > 0) {
    const heightM = settings.height_cm / 100
    bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10
  }
  return {
    success: true,
    date,
    weight_kg: Math.round(weightKg * 100) / 100,
    note: note ?? undefined,
    bmi: bmi ?? undefined,
  }
}

async function deleteWeightEntryTool(args: Record<string, unknown>): Promise<unknown> {
  const id = typeof args.entry_id === "string" ? args.entry_id : ""
  if (!id) {
    return { success: false, error: "Provide the entry_id to delete." }
  }
  await weightDb.deleteWeightEntry(id)
  return { success: true, deleted: { id } }
}

// Saved meals tools

async function getMealsTool(): Promise<unknown> {
  const meals = await listMeals()
  return {
    success: true,
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
          producer: item.producer || undefined,
          amount: item.amount,
          base_unit: item.base_unit,
          kcal: Math.round(item.nutrients.kcal),
          protein: Math.round(item.nutrients.protein * 10) / 10,
          carbs: Math.round(item.nutrients.carbs * 10) / 10,
          fat: Math.round(item.nutrients.fat * 10) / 10,
        })),
      }
    }),
  }
}

async function logMealTool(args: Record<string, unknown>): Promise<unknown> {
  const mealId = typeof args.meal_id === "string" ? args.meal_id : ""
  if (!mealId) {
    return { success: false, error: "Provide the meal_id to log." }
  }
  const meal = (await listMeals()).find((m) => m.id === mealId)
  if (!meal) {
    return { success: false, error: `No meal with id '${mealId}'.` }
  }
  const date = typeof args.date === "string" && args.date ? args.date : toDateKey()
  const mealType = isMealType(args.meal_type) ? args.meal_type : "snack"
  const { logged, skipped } = await logMealToDiary({ date, mealType, meal })
  if (logged === 0) {
    return { success: false, error: "No items of the meal could be logged." }
  }
  return {
    success: true,
    meal: meal.name,
    logged_items: logged,
    skipped_items: skipped,
    meal_type: mealType,
  }
}

async function saveMealTool(args: Record<string, unknown>): Promise<unknown> {
  const name = typeof args.name === "string" ? args.name.trim() : ""
  if (!name) {
    return { success: false, error: "Provide a meal name." }
  }
  const rawItems = Array.isArray(args.items) ? args.items : []
  if (rawItems.length === 0) {
    return { success: false, error: "Provide at least one food item for the meal." }
  }
  const items: MealItem[] = []
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue
    const itemObj = raw as Record<string, unknown>
    const itemName = typeof itemObj.name === "string" ? itemObj.name.trim() : ""
    if (!itemName) continue
    const amount = toPositiveNumber(itemObj.amount, 100)
    const baseUnit = typeof itemObj.base_unit === "string" ? itemObj.base_unit : "g"
    const kcal = toPositiveNumber(itemObj.kcal, 0)
    const protein = toPositiveNumber(itemObj.protein, 0)
    const carbs = toPositiveNumber(itemObj.carbs, 0)
    const fat = toPositiveNumber(itemObj.fat, 0)
    items.push({
      product_id:
        typeof itemObj.product_id === "string" && itemObj.product_id
          ? itemObj.product_id
          : generateId(),
      name: itemName,
      producer: typeof itemObj.producer === "string" ? itemObj.producer : "",
      amount,
      base_unit: baseUnit,
      nutrients: { kcal, protein, carbs, fat },
      serving: { serving: `${amount} ${baseUnit}`, amount, serving_quantity: amount },
    })
  }
  if (items.length === 0) {
    return { success: false, error: "None of the provided meal items were valid." }
  }
  const id = typeof args.meal_id === "string" && args.meal_id ? args.meal_id : generateId()
  const now = new Date().toISOString()
  await mealsDb.saveMeal({
    id,
    name,
    created_at: now,
    updated_at: now,
    items,
  })
  const totals = items.reduce(
    (acc, it) => ({
      kcal: acc.kcal + it.nutrients.kcal,
      protein: acc.protein + it.nutrients.protein,
      carbs: acc.carbs + it.nutrients.carbs,
      fat: acc.fat + it.nutrients.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
  return {
    success: true,
    meal: {
      id,
      name,
      items_count: items.length,
      kcal: Math.round(totals.kcal),
      protein: Math.round(totals.protein * 10) / 10,
      carbs: Math.round(totals.carbs * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
    },
  }
}

async function deleteMealTool(args: Record<string, unknown>): Promise<unknown> {
  const id = typeof args.meal_id === "string" ? args.meal_id : ""
  if (!id) {
    return { success: false, error: "Provide the meal_id to delete." }
  }
  await mealsDb.deleteMeal(id)
  return { success: true, deleted: { id } }
}

// Food database, favorites, and recents

async function searchFoodsTool(args: Record<string, unknown>): Promise<unknown> {
  const query = typeof args.query === "string" ? args.query.trim() : ""
  if (!query) {
    return { success: false, error: "Provide a food name to search for." }
  }
  const limit = Math.min(Math.max(Number(args.limit) || 8, 1), 15)

  const cached = await searchLocalFoods(query)
  let remote: Awaited<ReturnType<typeof searchFoodsRemote>> = []
  try {
    remote = await searchFoodsRemote(query)
  } catch {
    // Offline or no YAZIO session, so cached results still answer.
  }
  const seen = new Set<string>()
  const merged = [...remote, ...cached].filter((food) => {
    if (seen.has(food.product_id)) return false
    seen.add(food.product_id)
    return true
  })
  return {
    success: true,
    foods: merged.slice(0, limit).map((food) => ({
      product_id: food.product_id,
      name: food.name,
      producer: food.producer || undefined,
      per_100g: {
        kcal: food.nutrients.kcal,
        protein: food.nutrients.protein,
        carbs: food.nutrients.carbs,
        fat: food.nutrients.fat,
      },
      base_unit: food.base_unit || "g",
      verified: food.is_verified,
    })),
    offline_only: remote.length === 0,
  }
}

async function getFavoriteFoodsTool(): Promise<unknown> {
  const favorites = await getFavoriteFoods()
  return {
    success: true,
    foods: favorites.map((f) => ({
      product_id: f.product_id,
      name: f.name,
      producer: f.producer || undefined,
      per_100g: {
        kcal: f.nutrients.kcal,
        protein: f.nutrients.protein,
        carbs: f.nutrients.carbs,
        fat: f.nutrients.fat,
      },
      base_unit: f.base_unit || "g",
    })),
  }
}

async function toggleFavoriteFoodTool(args: Record<string, unknown>): Promise<unknown> {
  const productId = typeof args.product_id === "string" ? args.product_id.trim() : ""
  if (!productId) {
    return { success: false, error: "Provide the product_id of the food." }
  }
  let foodObj: SearchFoodResult | undefined
  if (typeof args.name === "string" && args.name.trim()) {
    const kcal = toPositiveNumber(args.kcal, 0)
    const protein = toPositiveNumber(args.protein, 0)
    const carbs = toPositiveNumber(args.carbs, 0)
    const fat = toPositiveNumber(args.fat, 0)
    foodObj = {
      product_id: productId,
      name: args.name.trim(),
      producer: typeof args.producer === "string" ? args.producer : "",
      nutrients: { kcal, protein, carbs, fat },
      serving: { serving: "100 g", amount: 100, serving_quantity: 100 },
      base_unit: typeof args.base_unit === "string" ? args.base_unit : "g",
      is_verified: true,
    }
  }
  const isFavorite = await toggleFavorite(productId, foodObj)
  return {
    success: true,
    product_id: productId,
    is_favorite: isFavorite,
  }
}

async function getRecentFoodsTool(args: Record<string, unknown>): Promise<unknown> {
  const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 30)
  const usages = await getRecentFoodUsages(limit)
  return {
    success: true,
    recent_foods: usages.map((u) => ({
      product_id: u.food.product_id,
      name: u.food.name,
      producer: u.food.producer || undefined,
      amount: u.amount,
      base_unit: u.food.base_unit || "g",
      kcal: Math.round(u.food.nutrients.kcal),
      protein: Math.round(u.food.nutrients.protein * 10) / 10,
      carbs: Math.round(u.food.nutrients.carbs * 10) / 10,
      fat: Math.round(u.food.nutrients.fat * 10) / 10,
      last_logged_at: u.lastLoggedAt,
    })),
  }
}

// Profile, settings, and goals tools

async function getGoalsTool(): Promise<unknown> {
  const settings = await getSettings()
  return {
    success: true,
    calorie_goal: settings.calorie_goal,
    protein_goal: settings.protein_goal,
    carbs_goal: settings.carbs_goal,
    fat_goal: settings.fat_goal,
    water_goal_ml: settings.water_goal_ml || 2500,
    target_weight_kg: settings.target_weight_kg || undefined,
    height_cm: settings.height_cm || undefined,
    units: settings.units,
  }
}

async function setGoalsTool(args: Record<string, unknown>): Promise<unknown> {
  const current = await getSettings()
  const next: Record<string, number> = {}
  const fields: [string, unknown][] = [
    ["calorie_goal", args.calorie_goal],
    ["protein_goal", args.protein_goal],
    ["carbs_goal", args.carbs_goal],
    ["fat_goal", args.fat_goal],
    ["water_goal_ml", args.water_goal_ml],
    ["target_weight_kg", args.target_weight_kg],
  ]
  for (const [key, value] of fields) {
    if (value !== undefined && value !== null && value !== "") {
      next[key] = toPositiveNumber(value, current[key as keyof typeof current] as number)
    }
  }
  if (Object.keys(next).length === 0) {
    return { success: false, error: "Provide at least one goal to update." }
  }
  await updateSettings(next as Parameters<typeof updateSettings>[0])
  const settings = await getSettings()
  return {
    success: true,
    calorie_goal: settings.calorie_goal,
    protein_goal: settings.protein_goal,
    carbs_goal: settings.carbs_goal,
    fat_goal: settings.fat_goal,
    water_goal_ml: settings.water_goal_ml,
    target_weight_kg: settings.target_weight_kg,
  }
}

async function getSettingsTool(): Promise<unknown> {
  const settings = await getSettings()
  return {
    success: true,
    units: settings.units,
    food_database_country: settings.food_database_country,
    yazio_sync_enabled: settings.yazio_sync_enabled === 1,
    update_check_enabled: settings.update_check_enabled === 1,
    ai_enabled: settings.ai_enabled === 1,
    theme_preference: settings.theme_preference,
    water_goal_ml: settings.water_goal_ml,
    height_cm: settings.height_cm,
    target_weight_kg: settings.target_weight_kg,
  }
}

async function setUnitsTool(args: Record<string, unknown>): Promise<unknown> {
  const units = args.units === "imperial" ? "imperial" : args.units === "metric" ? "metric" : ""
  if (!units) {
    return { success: false, error: "Provide units as 'metric' or 'imperial'." }
  }
  await updateSettings({ units })
  return { success: true, units }
}

async function setProfileTool(args: Record<string, unknown>): Promise<unknown> {
  const update: Record<string, unknown> = {}
  if (args.height_cm !== undefined && args.height_cm !== null && args.height_cm !== "") {
    update.height_cm = toPositiveNumber(args.height_cm, 0)
  }
  if (
    args.target_weight_kg !== undefined &&
    args.target_weight_kg !== null &&
    args.target_weight_kg !== ""
  ) {
    update.target_weight_kg = toPositiveNumber(args.target_weight_kg, 0)
  }
  if (
    args.water_goal_ml !== undefined &&
    args.water_goal_ml !== null &&
    args.water_goal_ml !== ""
  ) {
    update.water_goal_ml = toPositiveNumber(args.water_goal_ml, 0)
  }
  if (typeof args.food_database_country === "string") {
    update.food_database_country = args.food_database_country.trim().toUpperCase()
  }
  if (
    args.theme_preference === "system" ||
    args.theme_preference === "light" ||
    args.theme_preference === "dark"
  ) {
    update.theme_preference = args.theme_preference
  }
  if (args.units === "metric" || args.units === "imperial") {
    update.units = args.units
  }
  if (Object.keys(update).length === 0) {
    return { success: false, error: "Provide at least one profile setting to update." }
  }
  await updateSettings(update as Parameters<typeof updateSettings>[0])
  const settings = await getSettings()
  return {
    success: true,
    height_cm: settings.height_cm,
    target_weight_kg: settings.target_weight_kg,
    water_goal_ml: settings.water_goal_ml,
    units: settings.units,
    theme_preference: settings.theme_preference,
    food_database_country: settings.food_database_country,
  }
}

// Multi-day health summary and analytics tool

async function getHealthSummaryTool(args: Record<string, unknown>): Promise<unknown> {
  const days = Math.min(Math.max(Number(args.days) || 7, 1), 30)
  const today = toDateKey()
  const fromDate = shiftDateKey(today, -(days - 1))

  const [settings, weightEntries] = await Promise.all([
    getSettings(),
    weightDb.getWeightEntries(fromDate),
  ])

  const rows: {
    date: string
    kcal: number
    protein: number
    carbs: number
    fat: number
    water_ml: number
  }[] = []
  let totalKcal = 0
  let totalProtein = 0
  let totalCarbs = 0
  let totalFat = 0
  let totalWater = 0
  let daysWithNutrition = 0
  let daysWithWater = 0

  for (let i = days - 1; i >= 0; i--) {
    const date = shiftDateKey(today, -i)
    const [entries, waterTotal] = await Promise.all([
      diaryDb.getDiaryEntriesForDate(date),
      waterDb.getWaterTotalForDate(date),
    ])
    const dayTotals = entries.reduce(
      (acc, e) => ({
        kcal: acc.kcal + e.kcal,
        protein: acc.protein + e.protein,
        carbs: acc.carbs + e.carbs,
        fat: acc.fat + e.fat,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    )
    if (entries.length > 0) daysWithNutrition++
    if (waterTotal > 0) daysWithWater++

    totalKcal += dayTotals.kcal
    totalProtein += dayTotals.protein
    totalCarbs += dayTotals.carbs
    totalFat += dayTotals.fat
    totalWater += waterTotal

    rows.push({
      date,
      kcal: Math.round(dayTotals.kcal),
      protein: Math.round(dayTotals.protein * 10) / 10,
      carbs: Math.round(dayTotals.carbs * 10) / 10,
      fat: Math.round(dayTotals.fat * 10) / 10,
      water_ml: Math.round(waterTotal),
    })
  }

  const avgKcal = daysWithNutrition > 0 ? Math.round(totalKcal / daysWithNutrition) : 0
  const avgProtein =
    daysWithNutrition > 0 ? Math.round((totalProtein / daysWithNutrition) * 10) / 10 : 0
  const avgCarbs =
    daysWithNutrition > 0 ? Math.round((totalCarbs / daysWithNutrition) * 10) / 10 : 0
  const avgFat = daysWithNutrition > 0 ? Math.round((totalFat / daysWithNutrition) * 10) / 10 : 0
  const avgWater = daysWithWater > 0 ? Math.round(totalWater / daysWithWater) : 0

  let weightDelta: number | null = null
  if (weightEntries.length >= 2) {
    const oldest = weightEntries[0].weight_kg
    const latest = weightEntries[weightEntries.length - 1].weight_kg
    weightDelta = Math.round((latest - oldest) * 100) / 100
  }

  return {
    success: true,
    period_days: days,
    days_logged_nutrition: daysWithNutrition,
    days_logged_water: daysWithWater,
    averages: {
      kcal: avgKcal,
      protein: avgProtein,
      carbs: avgCarbs,
      fat: avgFat,
      water_ml: avgWater,
    },
    goals: {
      calorie_goal: settings.calorie_goal,
      protein_goal: settings.protein_goal,
      carbs_goal: settings.carbs_goal,
      fat_goal: settings.fat_goal,
      water_goal_ml: settings.water_goal_ml || 2500,
      target_weight_kg: settings.target_weight_kg || undefined,
    },
    weight_trend: {
      entries_count: weightEntries.length,
      latest_weight_kg:
        weightEntries.length > 0 ? weightEntries[weightEntries.length - 1].weight_kg : null,
      delta_kg: weightDelta,
    },
    history: rows,
  }
}

// Tool registry factory

export function createDiaryTools(): AiToolDefinition[] {
  return [
    // 1. Diary
    {
      name: "get_diary_summary",
      description:
        "Returns the diary entries, per-meal breakdown, calorie/macro totals and daily goals for a date (YYYY-MM-DD, defaults to today).",
      schema: {
        type: "object",
        properties: {
          date: stringSchema("Optional date as YYYY-MM-DD. Defaults to today."),
        },
      },
      readOnly: true,
      execute: getDiarySummaryTool,
    },
    {
      name: "get_diary_stats",
      description:
        "Returns per-day calorie and macro totals for the last N days (default 7, max 30), plus how many of those days had entries.",
      schema: {
        type: "object",
        properties: {
          days: numberSchema("Optional number of days (default 7, max 30)."),
        },
      },
      readOnly: true,
      execute: getDiaryStatsTool,
    },
    {
      name: "log_food",
      description:
        "Logs a manual food entry into the diary for a date (YYYY-MM-DD, defaults to today). Nutrients are per serving; amount is always 1 serving.",
      schema: {
        type: "object",
        properties: {
          date: stringSchema("Optional date as YYYY-MM-DD. Defaults to today."),
          meal_type: stringSchema("One of breakfast, lunch, dinner, snack. Defaults to snack."),
          name: stringSchema("Food name, for example 'Chicken breast, grilled'."),
          kcal: numberSchema("Calories for one serving."),
          protein: numberSchema("Protein in grams for one serving."),
          carbs: numberSchema("Carbs in grams for one serving."),
          fat: numberSchema("Fat in grams for one serving."),
        },
        required: ["name", "kcal"],
      },
      destructive: true,
      execute: logFoodTool,
    },
    {
      name: "update_food_entry",
      description:
        "Changes the amount (and optionally the meal slot) of an existing diary entry. Find the entry_id with get_diary_summary first.",
      schema: {
        type: "object",
        properties: {
          entry_id: stringSchema("The id of the diary entry to update."),
          amount: numberSchema("New amount in the entry's unit (grams for most foods)."),
          meal_type: stringSchema("Optional new meal slot: breakfast, lunch, dinner, snack."),
        },
        required: ["entry_id", "amount"],
      },
      destructive: true,
      execute: updateFoodEntryTool,
    },
    {
      name: "delete_food_entry",
      description:
        "Permanently removes a diary entry. Find the entry_id with get_diary_summary first.",
      schema: {
        type: "object",
        properties: {
          entry_id: stringSchema("The id of the diary entry to delete."),
        },
        required: ["entry_id"],
      },
      destructive: true,
      execute: deleteFoodEntryTool,
    },

    // 2. Water Tracking
    {
      name: "get_water",
      description:
        "Returns the water intake entries, daily total in milliliters, hydration goal, and percentage for a date (YYYY-MM-DD, defaults to today).",
      schema: {
        type: "object",
        properties: {
          date: stringSchema("Optional date as YYYY-MM-DD. Defaults to today."),
        },
      },
      readOnly: true,
      execute: getWaterTool,
    },
    {
      name: "log_water",
      description:
        "Logs water intake in milliliters (ml) for a date (YYYY-MM-DD, defaults to today). E.g. 250 for a glass, 500 for a bottle.",
      schema: {
        type: "object",
        properties: {
          amount_ml: numberSchema("Amount of water in milliliters (for example250, 500, 750)."),
          date: stringSchema("Optional date as YYYY-MM-DD. Defaults to today."),
        },
        required: ["amount_ml"],
      },
      destructive: true,
      execute: logWaterTool,
    },
    {
      name: "delete_water_entry",
      description: "Deletes a logged water entry by its entry_id.",
      schema: {
        type: "object",
        properties: {
          entry_id: stringSchema("The id of the water log entry to delete."),
        },
        required: ["entry_id"],
      },
      destructive: true,
      execute: deleteWaterEntryTool,
    },

    // 3. Weight Tracking and Body Metrics
    {
      name: "get_weight",
      description:
        "Returns recent bodyweight entries, latest weight, calculated BMI (if height is set), target weight, and recent delta.",
      schema: {
        type: "object",
        properties: {
          limit: numberSchema("Optional max number of entries (default 10, max 30)."),
        },
      },
      readOnly: true,
      execute: getWeightTool,
    },
    {
      name: "log_weight",
      description:
        "Logs or updates bodyweight in kilograms (kg) for a date (YYYY-MM-DD, defaults to today) with an optional note.",
      schema: {
        type: "object",
        properties: {
          weight_kg: numberSchema("Bodyweight in kilograms (for example75.5)."),
          date: stringSchema("Optional date as YYYY-MM-DD. Defaults to today."),
          note: stringSchema("Optional note (for example'Morning fasted', 'Post-workout')."),
        },
        required: ["weight_kg"],
      },
      destructive: true,
      execute: logWeightTool,
    },
    {
      name: "delete_weight_entry",
      description: "Deletes a bodyweight entry by its entry_id.",
      schema: {
        type: "object",
        properties: {
          entry_id: stringSchema("The id of the weight entry to delete."),
        },
        required: ["entry_id"],
      },
      destructive: true,
      execute: deleteWeightEntryTool,
    },

    // 4. Saved Meals
    {
      name: "get_meals",
      description:
        "Lists saved meals (recipes / food combinations you often eat together) with macro totals and itemized ingredients.",
      schema: { type: "object", properties: {} },
      readOnly: true,
      execute: getMealsTool,
    },
    {
      name: "log_meal",
      description:
        "Logs every item of a saved meal into the diary for a date (YYYY-MM-DD, defaults to today) and meal slot. Find the meal_id with get_meals first.",
      schema: {
        type: "object",
        properties: {
          meal_id: stringSchema("The id of the meal to log."),
          date: stringSchema("Optional date as YYYY-MM-DD. Defaults to today."),
          meal_type: stringSchema("One of breakfast, lunch, dinner, snack. Defaults to snack."),
        },
        required: ["meal_id"],
      },
      destructive: true,
      execute: logMealTool,
    },
    {
      name: "save_meal",
      description:
        "Creates or updates a saved meal template with a name and a list of food items with amounts and nutrients.",
      schema: {
        type: "object",
        properties: {
          name: stringSchema("Meal name, for example 'Post-Workout Oatmeal'."),
          items: {
            type: "array",
            description: "List of food items in the meal.",
            items: {
              type: "object",
              properties: {
                name: stringSchema("Item food name, for example 'Rolled Oats'."),
                amount: numberSchema("Amount in base units (grams or ml)."),
                base_unit: stringSchema("Base unit ('g' or 'ml', default 'g')."),
                kcal: numberSchema("Calories for this item amount."),
                protein: numberSchema("Protein in grams for this item amount."),
                carbs: numberSchema("Carbs in grams for this item amount."),
                fat: numberSchema("Fat in grams for this item amount."),
                product_id: stringSchema("Optional food product ID if known."),
                producer: stringSchema("Optional brand or producer name."),
              },
              required: ["name", "amount", "kcal"],
            },
          },
          meal_id: stringSchema("Optional meal id to update an existing meal."),
        },
        required: ["name", "items"],
      },
      destructive: true,
      execute: saveMealTool,
    },
    {
      name: "delete_meal",
      description: "Permanently deletes a saved meal template by meal_id.",
      schema: {
        type: "object",
        properties: {
          meal_id: stringSchema("The id of the saved meal to delete."),
        },
        required: ["meal_id"],
      },
      destructive: true,
      execute: deleteMealTool,
    },

    // 5. Food Search, Favorites, and Recents
    {
      name: "search_foods",
      description:
        "Searches the food database for a product and returns nutrition per 100 g. Use it to look up calories/macros before logging with log_food.",
      schema: {
        type: "object",
        properties: {
          query: stringSchema("Food name to search for, for example 'chicken breast'."),
          limit: numberSchema("Optional max results (default 8, max 15)."),
        },
        required: ["query"],
      },
      readOnly: true,
      execute: searchFoodsTool,
    },
    {
      name: "get_favorite_foods",
      description: "Returns the list of user's starred / favorited foods with nutrition info.",
      schema: { type: "object", properties: {} },
      readOnly: true,
      execute: getFavoriteFoodsTool,
    },
    {
      name: "toggle_favorite_food",
      description: "Stars or unstars a food in the database by its product_id.",
      schema: {
        type: "object",
        properties: {
          product_id: stringSchema("Product ID of the food."),
          name: stringSchema("Optional name of the food if saving from search."),
          kcal: numberSchema("Optional kcal per 100g."),
          protein: numberSchema("Optional protein per 100g."),
          carbs: numberSchema("Optional carbs per 100g."),
          fat: numberSchema("Optional fat per 100g."),
        },
        required: ["product_id"],
      },
      destructive: true,
      execute: toggleFavoriteFoodTool,
    },
    {
      name: "get_recent_foods",
      description: "Returns recently logged foods with past portion sizes for fast re-logging.",
      schema: {
        type: "object",
        properties: {
          limit: numberSchema("Optional max results (default 10, max 30)."),
        },
      },
      readOnly: true,
      execute: getRecentFoodsTool,
    },

    // 6. Goals, Profile, and Settings
    {
      name: "get_goals",
      description:
        "Returns current daily calorie, protein, carbs, fat, and water goals, plus target weight and height.",
      schema: { type: "object", properties: {} },
      readOnly: true,
      execute: getGoalsTool,
    },
    {
      name: "set_goals",
      description:
        "Updates daily nutrition and hydration goals. Provide only the goals to change (calorie_goal, protein_goal, carbs_goal, fat_goal, water_goal_ml, target_weight_kg).",
      schema: {
        type: "object",
        properties: {
          calorie_goal: numberSchema("Daily calorie goal in kcal."),
          protein_goal: numberSchema("Daily protein goal in grams."),
          carbs_goal: numberSchema("Daily carbs goal in grams."),
          fat_goal: numberSchema("Daily fat goal in grams."),
          water_goal_ml: numberSchema("Daily hydration goal in milliliters (ml)."),
          target_weight_kg: numberSchema("Target bodyweight in kilograms (kg)."),
        },
      },
      destructive: true,
      execute: setGoalsTool,
    },
    {
      name: "get_settings",
      description:
        "Returns app settings: units (metric/imperial), food database country, hydration goal, height, target weight, theme, and YAZIO sync flag.",
      schema: { type: "object", properties: {} },
      readOnly: true,
      execute: getSettingsTool,
    },
    {
      name: "set_units",
      description: "Changes the units used for weight and water display ('metric' or 'imperial').",
      schema: {
        type: "object",
        properties: {
          units: stringSchema("One of 'metric' or 'imperial'."),
        },
        required: ["units"],
      },
      destructive: true,
      execute: setUnitsTool,
    },
    {
      name: "set_profile",
      description:
        "Updates user profile and health settings (height in cm, target weight in kg, water goal in ml, units, food database country, theme).",
      schema: {
        type: "object",
        properties: {
          height_cm: numberSchema("Body height in centimeters (for example180)."),
          target_weight_kg: numberSchema("Target bodyweight in kilograms (for example72)."),
          water_goal_ml: numberSchema("Daily water intake goal in milliliters (for example2500)."),
          units: stringSchema("Unit system: 'metric' or 'imperial'."),
          food_database_country: stringSchema(
            "Country code for food searches (for example'US', 'DE', 'GB').",
          ),
          theme_preference: stringSchema("Theme: 'system', 'light', or 'dark'."),
        },
      },
      destructive: true,
      execute: setProfileTool,
    },

    // 7. Multi-Day Health Summary and Analytics
    {
      name: "get_health_summary",
      description:
        "Returns an aggregated multi-day health summary: average daily calories and macros, hydration compliance, weight trend delta, and day-by-day history.",
      schema: {
        type: "object",
        properties: {
          days: numberSchema("Number of past days to analyze (default 7, max 30)."),
        },
      },
      readOnly: true,
      execute: getHealthSummaryTool,
    },
  ]
}
