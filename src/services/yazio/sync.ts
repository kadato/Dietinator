import type { DiaryEntry, MealType } from "@/types"
import * as diaryDb from "@/db/diary"
import * as foodCacheDb from "@/db/food-cache"
import { getSettings } from "@/db/settings"
import { matchesDateKey, toDateKey, toYazioApiDate } from "@/utils/date"
import { generateId } from "@/utils/id"
import { nutrientsForAmount, nutrientsFromYazio, toKcal } from "@/utils/nutrients"
import { withRetry } from "@/utils/retry"
import { ensureYazioClient, getYazioEnergyUnit, getYazioProfile } from "./client"
import { getFoodRemote } from "./foods"

/** YAZIO daily summary data shown on the dashboard (burned kcal, steps, water, weight). */
export type YazioDailySummary = {
  activityEnergy: number
  steps: number
  waterIntake: number
  waterGoal: number
  weight: number | null
}

/** Single-flight per entry: concurrent callers share one push instead of duplicating it. */
const inFlightSyncs = new Map<string, Promise<boolean>>()

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function syncEntryToYazio(entry: DiaryEntry): Promise<boolean> {
  const existing = inFlightSyncs.get(entry.id)
  if (existing) return existing
  const promise = doSyncEntryToYazio(entry).finally(() => {
    inFlightSyncs.delete(entry.id)
  })
  inFlightSyncs.set(entry.id, promise)
  return promise
}

async function doSyncEntryToYazio(entry: DiaryEntry): Promise<boolean> {
  const settings = await getSettings()
  if (!settings.yazio_sync_enabled || !entry.food_id) return false

  const yazio = await ensureYazioClient()
  if (!yazio) return false

  try {
    const foodId = entry.food_id
    if (!foodId) return false
    const product = await getFoodRemote(foodId)
    if (!product) return false

    const yazioId = entry.yazio_item_id ?? generateId()

    if (entry.yazio_item_id) {
      // A previous attempt already pushed this id but never confirmed it.
      // Remove-then-add makes the retry idempotent instead of duplicating.
      try {
        await yazio.user.removeConsumedItem(yazioId)
      } catch {
        // Best-effort: the item may never have been created.
      }
    } else {
      // Reserve the id before the network call so a crash between push and
      // confirmation cannot lead to a duplicate on retry.
      await diaryDb.reserveYazioItemId(entry.id, yazioId)
    }

    await withRetry(() =>
      yazio.user.addConsumedItem({
        id: yazioId,
        product_id: foodId,
        date: entry.date,
        daytime: entry.meal_type as MealType,
        amount: entry.amount,
        serving: product.serving.serving,
        serving_quantity: product.serving.serving_quantity,
      }),
    )
    await diaryDb.markDiaryEntrySynced(entry.id, yazioId)
    return true
  } catch {
    return false
  }
}

/** Best-effort removal of a consumed item from YAZIO (used when deleting locally). */
export async function removeEntryFromYazio(yazioItemId: string): Promise<void> {
  const yazio = await ensureYazioClient()
  if (!yazio) return
  await withRetry(() => yazio.user.removeConsumedItem(yazioItemId))
}

export async function syncPendingEntries(): Promise<number> {
  const settings = await getSettings()
  if (!settings.yazio_sync_enabled) return 0

  // Oldest-first, bounded batch — syncing years of history at once is not useful.
  const pending = await diaryDb.getUnsyncedEntries(20)
  let synced = 0
  let consecutiveFailures = 0
  for (const entry of pending) {
    const ok = await syncEntryToYazio(entry)
    if (ok) {
      synced += 1
      consecutiveFailures = 0
    } else {
      consecutiveFailures += 1
    }
    // Give up early on a broken remote instead of hammering it.
    if (consecutiveFailures >= 3) break
    await delay(150 + Math.random() * 150)
  }
  return synced
}

type YazioConsumedProduct = {
  id: string
  date: string
  product_id: string
  amount: number
  serving: string | null
  serving_quantity: number | null
  daytime: MealType
}

type YazioSimpleProduct = {
  id: string
  date: string
  daytime: MealType
  name: string
  nutrients: Record<string, number>
}

type YazioRecipePortion = {
  id: string
  date: string
  daytime: MealType
  name?: string
  nutrients?: Record<string, number>
  amount?: number
}

export type MealGoals = Partial<Record<MealType, number>>

export type DiaryImportResult = {
  imported: number
  skipped: number
  failed: number
  mealGoals: MealGoals
  summary: YazioDailySummary | null
  error?: string
}

async function fetchDailyData(date: string): Promise<{
  mealGoals: MealGoals
  summary: YazioDailySummary | null
}> {
  const yazio = await ensureYazioClient()
  if (!yazio) return { mealGoals: {}, summary: null }

  try {
    const unitEnergy = await getYazioEnergyUnit()
    const summary = await yazio.user.getDailySummary({
      date: toYazioApiDate(date),
    })
    const meals = summary.meals
    return {
      mealGoals: {
        breakfast: toKcal(meals.breakfast.energy_goal, unitEnergy),
        lunch: toKcal(meals.lunch.energy_goal, unitEnergy),
        dinner: toKcal(meals.dinner.energy_goal, unitEnergy),
        snack: toKcal(meals.snack.energy_goal, unitEnergy),
      },
      summary: {
        activityEnergy: summary.activity_energy ?? 0,
        steps: summary.steps ?? 0,
        waterIntake: summary.water_intake ?? 0,
        waterGoal: summary.goals?.water ?? 0,
        weight: summary.user?.current_weight ?? null,
      },
    }
  } catch {
    return { mealGoals: {}, summary: null }
  }
}

/** Run async work with bounded concurrency, preserving input order. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

async function importConsumedProduct(
  item: YazioConsumedProduct,
  date: string,
  existingIds: Set<string>,
  deletedIds: Set<string>,
  unitEnergy: string,
  productCache: Map<string, Awaited<ReturnType<typeof getFoodRemote>>>,
): Promise<"imported" | "skipped" | "failed"> {
  if (!matchesDateKey(item.date, date)) return "skipped"
  if (existingIds.has(item.id)) return "skipped"
  if (deletedIds.has(item.id)) return "skipped"
  // Re-check the tombstone table: an import that started before a delete holds
  // a stale snapshot and would otherwise resurrect the entry.
  if (await diaryDb.isDeletedYazioItemId(item.id)) return "skipped"

  let food = productCache.get(item.product_id)
  if (food === undefined) {
    food = await getFoodRemote(item.product_id)
    productCache.set(item.product_id, food)
  }
  if (!food) return "failed"

  const scaled = nutrientsForAmount(food.nutrients, food.serving, item.amount, food.base_unit)

  await diaryDb.addDiaryEntry({
    id: generateId(),
    date,
    meal_type: item.daytime,
    food_id: item.product_id,
    food_name: food.name,
    amount: item.amount,
    unit: food.base_unit || "g",
    kcal: scaled.kcal,
    protein: scaled.protein,
    carbs: scaled.carbs,
    fat: scaled.fat,
    created_at: new Date().toISOString(),
    yazio_synced: 1,
    yazio_item_id: item.id,
  })

  await foodCacheDb.saveFoodToCache(food)
  await foodCacheDb.touchFoodUsed(food.product_id)
  existingIds.add(item.id)
  return "imported"
}

async function importSimpleProduct(
  item: YazioSimpleProduct,
  date: string,
  existingIds: Set<string>,
  deletedIds: Set<string>,
  unitEnergy: string,
): Promise<"imported" | "skipped" | "failed"> {
  if (!matchesDateKey(item.date, date)) return "skipped"
  if (existingIds.has(item.id)) return "skipped"
  if (deletedIds.has(item.id)) return "skipped"
  if (!item.name?.trim()) return "failed"

  const scaled = nutrientsFromYazio(item.nutrients ?? {}, unitEnergy)

  // Re-check the tombstone table (see importConsumedProduct).
  if (await diaryDb.isDeletedYazioItemId(item.id)) return "skipped"

  await diaryDb.addDiaryEntry({
    id: generateId(),
    date,
    meal_type: item.daytime,
    food_id: null,
    food_name: item.name.trim(),
    amount: 1,
    unit: "serving",
    kcal: scaled.kcal,
    protein: scaled.protein,
    carbs: scaled.carbs,
    fat: scaled.fat,
    created_at: new Date().toISOString(),
    yazio_synced: 1,
    yazio_item_id: item.id,
  })
  existingIds.add(item.id)
  return "imported"
}

async function importRecipePortion(
  item: YazioRecipePortion,
  date: string,
  existingIds: Set<string>,
  deletedIds: Set<string>,
  unitEnergy: string,
): Promise<"imported" | "skipped" | "failed"> {
  if (!matchesDateKey(item.date, date)) return "skipped"
  if (existingIds.has(item.id)) return "skipped"
  if (deletedIds.has(item.id)) return "skipped"

  const name = item.name?.trim() || "Recipe"
  const nutrients = item.nutrients ?? {}
  const scaled = nutrientsFromYazio(nutrients, unitEnergy)
  if (scaled.kcal <= 0 && !item.name) return "failed"

  // Re-check the tombstone table (see importConsumedProduct).
  if (await diaryDb.isDeletedYazioItemId(item.id)) return "skipped"

  await diaryDb.addDiaryEntry({
    id: generateId(),
    date,
    meal_type: item.daytime,
    food_id: null,
    food_name: name,
    amount: item.amount ?? 1,
    unit: "portion",
    kcal: scaled.kcal,
    protein: scaled.protein,
    carbs: scaled.carbs,
    fat: scaled.fat,
    created_at: new Date().toISOString(),
    yazio_synced: 1,
    yazio_item_id: item.id,
  })

  existingIds.add(item.id)
  return "imported"
}

export async function importDiaryFromYazio(date: string = toDateKey()): Promise<DiaryImportResult> {
  const empty: DiaryImportResult = {
    imported: 0,
    skipped: 0,
    failed: 0,
    mealGoals: {},
    summary: null,
  }

  const yazio = await ensureYazioClient()
  if (!yazio) return empty

  const { mealGoals, summary } = await fetchDailyData(date)

  try {
    const [consumed, existingIds, deletedIds, unitEnergy] = await Promise.all([
      yazio.user.getConsumedItems({ date: toYazioApiDate(date) }),
      diaryDb.getYazioItemIdsForDate(date),
      diaryDb.getDeletedYazioItemIds(),
      getYazioEnergyUnit(),
    ])

    let imported = 0
    let skipped = 0
    let failed = 0
    const productCache = new Map<string, Awaited<ReturnType<typeof getFoodRemote>>>()

    // Bounded concurrency for remote product fetches — a full day imports
    // quickly without firing dozens of simultaneous HTTP requests.
    const productResults = await mapPool(consumed.products as YazioConsumedProduct[], 4, (item) =>
      importConsumedProduct(item, date, existingIds, deletedIds, unitEnergy, productCache),
    )
    for (const result of productResults) {
      if (result === "imported") imported += 1
      else if (result === "skipped") skipped += 1
      else failed += 1
    }

    for (const raw of consumed.simple_products as YazioSimpleProduct[]) {
      const result = await importSimpleProduct(raw, date, existingIds, deletedIds, unitEnergy)
      if (result === "imported") imported += 1
      else if (result === "skipped") skipped += 1
      else failed += 1
    }

    for (const raw of consumed.recipe_portions as YazioRecipePortion[]) {
      const result = await importRecipePortion(raw, date, existingIds, deletedIds, unitEnergy)
      if (result === "imported") imported += 1
      else if (result === "skipped") skipped += 1
      else failed += 1
    }

    return { imported, skipped, failed, mealGoals, summary }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reach YAZIO."
    return { ...empty, mealGoals, error: message }
  }
}

/** Import daily goals and consumed foods from YAZIO for one date. */
export async function importFromYazio(date: string = toDateKey()): Promise<DiaryImportResult> {
  await loadGoalsFromYazio(date)
  return importDiaryFromYazio(date)
}

export async function loadGoalsFromYazio(date: string = toDateKey()): Promise<void> {
  const yazio = await ensureYazioClient()
  if (!yazio) return

  try {
    const [goals, profile, unitEnergy] = await Promise.all([
      yazio.user.getGoals({ date: toYazioApiDate(date) }),
      getYazioProfile(),
      getYazioEnergyUnit(),
    ])
    const { getSettings, updateSettings } = await import("@/db/settings")
    const current = await getSettings()
    await updateSettings({
      calorie_goal: toKcal(goals["energy.energy"] ?? 2000, unitEnergy),
      protein_goal: goals["nutrient.protein"] ?? 150,
      carbs_goal: goals["nutrient.carb"] ?? 200,
      fat_goal: goals["nutrient.fat"] ?? 65,
      ...(profile?.food_database_country && !current.food_database_country?.trim()
        ? { food_database_country: profile.food_database_country }
        : {}),
    })
  } catch {
    // Goals stay local defaults
  }
}
