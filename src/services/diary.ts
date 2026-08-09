import * as diaryDb from "@/db/diary"
import * as foodCacheDb from "@/db/food-cache"
import { getSettings } from "@/db/settings"
import type { DiaryEntry, FoodNutrients, MealType, SearchFoodResult } from "@/types"
import { isPerGramNutrients, nutrientsForAmount } from "@/utils/nutrients"
import { generateId } from "@/utils/id"
import { pushSnapshot } from "./agent-bridge"
import { getFoodRemote } from "./yazio/foods"
import { removeEntryFromYazio, syncEntryToYazio } from "./yazio/sync"

function nutrientsDiffer(a: FoodNutrients, b: FoodNutrients): boolean {
  return (
    Math.abs(a.kcal - b.kcal) > 1 ||
    Math.abs(a.protein - b.protein) > 0.2 ||
    Math.abs(a.carbs - b.carbs) > 0.2 ||
    Math.abs(a.fat - b.fat) > 0.2
  )
}

/**
 * Resolve cache rows in one query; refetch from YAZIO only when the cache is
 * missing or still holds legacy per-gram values (search rows are per-gram by
 * design and are normalized on save, so per-gram cache rows are always stale).
 *
 * Pass `remote: false` for the first paint: the diary renders straight from
 * SQLite (nutrients are stored scaled per entry) and stale entries get refined
 * by a background pass.
 */
export async function getDiaryEntriesForDate(
  date: string,
  options?: { remote?: boolean },
): Promise<DiaryEntry[]> {
  const entries = await diaryDb.getDiaryEntriesForDate(date)
  if (options?.remote === false) return entries
  const foodIds = entries.map((e) => e.food_id).filter((id): id is string => Boolean(id))
  const cached = await foodCacheDb.getFoodsByIds(foodIds)

  return Promise.all(
    entries.map(async (entry) => {
      if (!entry.food_id) return entry
      const food = cached.get(entry.food_id)
      const needRemote =
        !food ||
        isPerGramNutrients(food.nutrients, food.base_unit || "g", food.serving.serving_quantity)
      const resolved = needRemote ? ((await getFoodRemote(entry.food_id)) ?? food) : food
      if (!resolved) return entry

      const scaled = nutrientsForAmount(
        resolved.nutrients,
        resolved.serving,
        entry.amount,
        resolved.base_unit,
      )
      if (!nutrientsDiffer(scaled, entry)) return entry

      await diaryDb.updateDiaryEntryNutrients(entry.id, scaled)
      return { ...entry, ...scaled }
    }),
  )
}

export async function logFood(params: {
  date: string
  mealType: MealType
  food: SearchFoodResult
  amount: number
}): Promise<DiaryEntry> {
  const { date, mealType, food, amount } = params
  const scaled = nutrientsForAmount(food.nutrients, food.serving, amount, food.base_unit)

  const entry = await diaryDb.addDiaryEntry({
    id: generateId(),
    // Reserve the YAZIO item id up front so a background import that runs
    // before the async sync finishes can never duplicate this entry: the
    // import's existing-ids check sees it immediately.
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

  // Cache writes must never fail the log — the entry is already saved.
  foodCacheDb.saveFoodToCache(food).catch(() => undefined)
  foodCacheDb.touchFoodUsed(food.product_id).catch(() => undefined)

  syncEntryToYazio(entry).catch(() => undefined)
  // Web-host agent bridge: keep the /mcp snapshot current (web only).
  pushSnapshot().catch(() => undefined)

  return entry
}

/** Log a one-off entry (Quick Add / manual food) with no YAZIO product behind it. */
export async function logManualEntry(params: {
  date: string
  mealType: MealType
  name: string
  kcal: number
  protein?: number
  carbs?: number
  fat?: number
}): Promise<DiaryEntry> {
  const entry = await diaryDb.addDiaryEntry({
    id: generateId(),
    date: params.date,
    meal_type: params.mealType,
    food_id: null,
    food_name: params.name.trim(),
    amount: 1,
    unit: "serving",
    kcal: params.kcal,
    protein: params.protein ?? 0,
    carbs: params.carbs ?? 0,
    fat: params.fat ?? 0,
    created_at: new Date().toISOString(),
  })
  pushSnapshot().catch(() => undefined)
  return entry
}

export async function updateDiaryEntry(params: {
  id: string
  amount: number
  mealType: MealType
}): Promise<DiaryEntry | null> {
  const { id, amount, mealType } = params
  const current = await diaryDb.getDiaryEntryById(id)
  if (!current) return null
  if (amount <= 0 || !Number.isFinite(amount)) return current

  let nutrients: FoodNutrients
  let unit = current.unit

  if (current.food_id) {
    const food =
      (await foodCacheDb.getFoodById(current.food_id)) ?? (await getFoodRemote(current.food_id))
    if (food) {
      nutrients = nutrientsForAmount(food.nutrients, food.serving, amount, food.base_unit)
      unit = food.base_unit || "g"
    } else {
      nutrients = scaleFromStored(current, amount)
    }
  } else {
    // Manual/simple/recipe entries have no product lookup — scale stored totals linearly.
    nutrients = scaleFromStored(current, amount)
  }

  await diaryDb.updateDiaryEntryDetails(id, {
    amount,
    unit,
    meal_type: mealType,
    food_name: current.food_name,
    nutrients,
  })

  const updated = await diaryDb.getDiaryEntryById(id)

  // Keep YAZIO in step when the push already happened; best-effort.
  if (updated && updated.yazio_item_id) {
    syncUpdatedEntryToYazio(updated).catch(() => undefined)
  }

  pushSnapshot().catch(() => undefined)

  return updated
}

function scaleFromStored(entry: DiaryEntry, amount: number): FoodNutrients {
  if (entry.amount <= 0) {
    return { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  }
  const factor = amount / entry.amount
  return {
    kcal: Math.round(entry.kcal * factor),
    protein: Math.round(entry.protein * factor * 10) / 10,
    carbs: Math.round(entry.carbs * factor * 10) / 10,
    fat: Math.round(entry.fat * factor * 10) / 10,
  }
}

/** Re-push an edited entry: remove the old YAZIO item, then push the new values. */
async function syncUpdatedEntryToYazio(entry: DiaryEntry): Promise<void> {
  const settings = await getSettings()
  if (!settings.yazio_sync_enabled || !entry.food_id || !entry.yazio_item_id) return

  try {
    await removeEntryFromYazio(entry.yazio_item_id)
    await syncEntryToYazio({ ...entry, yazio_item_id: null })
  } catch {
    // Best-effort; the diary stays correct locally.
  }
}

export async function deleteFoodEntry(id: string): Promise<void> {
  const entry = await diaryDb.getDiaryEntryById(id)
  if (!entry) return

  if (entry.yazio_item_id) {
    // Tombstone regardless of remote success so the item never resurrects on import.
    await diaryDb.addDeletedYazioItemId(entry.yazio_item_id)
    if (entry.yazio_synced) {
      removeEntryFromYazio(entry.yazio_item_id).catch(() => undefined)
    }
  }

  await diaryDb.removeDiaryEntry(id)
  diaryDb.pruneDeletedYazioItems().catch(() => undefined)
  pushSnapshot().catch(() => undefined)
}

export { exportDiaryJson, exportDiaryCsv } from "@/db/diary"
