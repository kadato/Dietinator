import type { FoodNutrients, Meal, MealItem, MealType, SearchFoodResult } from "@/types"
import * as diaryDb from "@/db/diary"
import * as foodCacheDb from "@/db/food-cache"
import * as mealDb from "@/db/meals"
import { generateId } from "@/utils/id"
import { nutrientsForAmount, sumNutrients } from "@/utils/nutrients"
import { getFoodRemote } from "./yazio/foods"
import { syncEntryToYazio } from "./yazio/sync"

export function listMeals(): Promise<Meal[]> {
  return mealDb.getMeals()
}

export function getMealById(id: string): Promise<Meal | null> {
  return mealDb.getMealById(id)
}

/** Create a new meal (generates the id) or overwrite an existing one. */
export async function saveMeal(params: {
  id?: string
  name: string
  items: MealItem[]
}): Promise<Meal> {
  const id = params.id ?? generateId()
  const now = new Date().toISOString()
  await mealDb.saveMeal({
    id,
    name: params.name,
    created_at: now,
    updated_at: now,
    items: params.items,
  })

  // Warm the food cache with every ingredient so meals stay fully usable
  // offline (searchable and editable) even after the cache was cleared.
  // Best-effort and silent: saving a meal is not consuming the foods.
  for (const item of params.items) {
    foodCacheDb.saveFoodToCache(itemToFood(item), null, true).catch(() => undefined)
  }

  const saved = await mealDb.getMealById(id)
  if (!saved) throw new Error("Could not save meal.")
  return saved
}

export function deleteMeal(id: string): Promise<void> {
  return mealDb.deleteMeal(id)
}

export async function duplicateMeal(id: string): Promise<Meal> {
  const meal = await mealDb.getMealById(id)
  if (!meal) throw new Error("Meal not found.")
  const newId = generateId()
  const now = new Date().toISOString()
  const baseName = meal.name.replace(/ copy( \d+)?$/i, "").trim()
  let newName = `${baseName} copy`
  const existing = await mealDb.getMeals()
  const names = new Set(existing.map((m) => m.name.toLowerCase()))
  if (names.has(newName.toLowerCase())) {
    let n = 2
    while (names.has(`${baseName} copy ${n}`.toLowerCase())) n += 1
    newName = `${baseName} copy ${n}`
  }
  await mealDb.saveMeal({
    id: newId,
    name: newName,
    created_at: now,
    updated_at: now,
    items: meal.items,
  })
  for (const item of meal.items) {
    foodCacheDb.saveFoodToCache(itemToFood(item), null, true).catch(() => undefined)
  }
  const saved = await mealDb.getMealById(newId)
  if (!saved) throw new Error("Could not duplicate meal.")
  return saved
}

/** Total nutrients for the meal as configured (amounts are already baked in). */
export function mealTotals(meal: Pick<Meal, "items">): FoodNutrients {
  return sumNutrients(
    meal.items.map((item) =>
      nutrientsForAmount(item.nutrients, item.serving, item.amount, item.base_unit),
    ),
  )
}

function itemToFood(item: MealItem): SearchFoodResult {
  return {
    product_id: item.product_id,
    name: item.name,
    producer: item.producer,
    nutrients: item.nutrients,
    serving: item.serving,
    base_unit: item.base_unit,
    is_verified: false,
  }
}

/**
 * Log every item of a meal as a diary entry for the given day/meal slot.
 * Each entry keeps its product id so editing and optional YAZIO sync work
 * exactly like individually logged foods. Items whose product cannot be
 * resolved are skipped (offline first-use of a cleared cache).
 */
export async function logMealToDiary(params: {
  date: string
  mealType: MealType
  meal: Meal
}): Promise<{ logged: number; skipped: string[] }> {
  const { date, mealType, meal } = params
  let logged = 0
  const skipped: string[] = []

  for (const item of meal.items) {
    const amount = Number(item.amount)
    if (!amount || amount <= 0) {
      skipped.push(item.name)
      continue
    }
    const resolved =
      (await foodCacheDb.getFoodById(item.product_id)) ?? (await getFoodRemote(item.product_id))
    const food = resolved ?? itemToFood(item)
    const scaled = nutrientsForAmount(food.nutrients, food.serving, amount, food.base_unit)

    const entry = await diaryDb.addDiaryEntry({
      id: generateId(),
      // Reserve the YAZIO item id up front so a background import that runs
      // before the async sync finishes can never duplicate this entry.
      yazio_item_id: generateId(),
      date,
      meal_type: mealType,
      food_id: food.product_id,
      food_name: food.name,
      amount,
      unit: food.base_unit || "g",
      kcal: scaled.kcal,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
      created_at: new Date().toISOString(),
    })
    logged += 1

    // Cache writes must never fail the log because the entry is already saved.
    foodCacheDb.saveFoodToCache(food).catch(() => undefined)
    foodCacheDb.touchFoodUsed(food.product_id, amount).catch(() => undefined)
    syncEntryToYazio(entry).catch(() => undefined)
  }

  if (logged > 0) {
    mealDb.touchMealUsed(meal.id).catch(() => undefined)
  }

  return { logged, skipped }
}
