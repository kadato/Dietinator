import * as diaryDb from "@/db/diary"
import { getSettings, updateSettings } from "@/db/settings"
import { searchLocalFoods } from "@/db/food-cache"
import { searchFoodsRemote } from "@/services/yazio/foods"
import { updateDiaryEntry as updateDiaryEntryService } from "@/services/diary"
import { listMeals, logMealToDiary, mealTotals } from "@/services/meals"
import type { DiaryEntry, MealType } from "@/types"
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

async function getGoalsTool(): Promise<unknown> {
  const settings = await getSettings()
  return {
    success: true,
    calorie_goal: settings.calorie_goal,
    protein_goal: settings.protein_goal,
    carbs_goal: settings.carbs_goal,
    fat_goal: settings.fat_goal,
    units: settings.units,
  }
}

function toPositiveNumber(value: unknown, fallback: number): number {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : fallback
}

async function setGoalsTool(args: Record<string, unknown>): Promise<unknown> {
  const current = await getSettings()
  const next: Record<string, number> = {}
  const fields: [string, unknown][] = [
    ["calorie_goal", args.calorie_goal],
    ["protein_goal", args.protein_goal],
    ["carbs_goal", args.carbs_goal],
    ["fat_goal", args.fat_goal],
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
    // Offline or no YAZIO session — cached results still answer.
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

async function getSettingsTool(): Promise<unknown> {
  const settings = await getSettings()
  return {
    success: true,
    units: settings.units,
    food_database_country: settings.food_database_country,
    yazio_sync_enabled: settings.yazio_sync_enabled === 1,
    update_check_enabled: settings.update_check_enabled === 1,
    ai_enabled: settings.ai_enabled === 1,
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

export function createDiaryTools(): AiToolDefinition[] {
  return [
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
      name: "get_goals",
      description: "Returns the current daily calorie and macro goals.",
      schema: { type: "object", properties: {} },
      readOnly: true,
      execute: getGoalsTool,
    },
    {
      name: "set_goals",
      description:
        "Updates daily calorie and macro goals. Provide only the goals to change (calorie_goal, protein_goal, carbs_goal, fat_goal).",
      schema: {
        type: "object",
        properties: {
          calorie_goal: numberSchema("Daily calorie goal in kcal."),
          protein_goal: numberSchema("Daily protein goal in grams."),
          carbs_goal: numberSchema("Daily carbs goal in grams."),
          fat_goal: numberSchema("Daily fat goal in grams."),
        },
      },
      destructive: true,
      execute: setGoalsTool,
    },
    {
      name: "get_settings",
      description:
        "Returns app settings: units (metric/imperial), food database country, YAZIO sync flag, update check flag and AI assistant flag.",
      schema: { type: "object", properties: {} },
      readOnly: true,
      execute: getSettingsTool,
    },
    {
      name: "set_units",
      description: "Changes the units used for weight and water display.",
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
      name: "log_food",
      description:
        "Logs a manual food entry into the diary for a date (YYYY-MM-DD, defaults to today). Nutrients are per serving; amount is always 1 serving.",
      schema: {
        type: "object",
        properties: {
          date: stringSchema("Optional date as YYYY-MM-DD. Defaults to today."),
          meal_type: stringSchema("One of breakfast, lunch, dinner, snack. Defaults to snack."),
          name: stringSchema("Food name, e.g. 'Chicken breast, grilled'."),
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
    {
      name: "search_foods",
      description:
        "Searches the food database for a product and returns nutrition per 100 g. Use it to look up calories/macros before logging with log_food.",
      schema: {
        type: "object",
        properties: {
          query: stringSchema("Food name to search for, e.g. 'chicken breast'."),
          limit: numberSchema("Optional max results (default 8, max 15)."),
        },
        required: ["query"],
      },
      readOnly: true,
      execute: searchFoodsTool,
    },
    {
      name: "get_meals",
      description:
        "Lists saved meals (foods you often eat together) with their total calories and macros.",
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
  ]
}
