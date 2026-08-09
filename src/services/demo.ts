import { getDatabase } from "@/db/database"
import { saveFoodToCache } from "@/db/food-cache"
import { addDiaryEntry } from "@/db/diary"
import { saveMeal } from "@/db/meals"
import { updateSettings } from "@/db/settings"
import { toDateKey, shiftDateKey } from "@/utils/date"
import { setDemoLoggedIn } from "@/services/yazio/auth-storage"
import type { FoodServing, SearchFoodResult } from "@/types"

const serving100: FoodServing = { serving: "100 g", amount: 100, serving_quantity: 100 }

const banana: SearchFoodResult = {
  product_id: "demo-banana",
  name: "Banana",
  producer: "Demo foods",
  nutrients: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
  serving: serving100,
  base_unit: "g",
  is_verified: true,
}

const oatmeal: SearchFoodResult = {
  product_id: "demo-oatmeal",
  name: "Oatmeal, cooked",
  producer: "Demo foods",
  nutrients: { kcal: 71, protein: 2.5, carbs: 12, fat: 1.5 },
  serving: serving100,
  base_unit: "g",
  is_verified: true,
}

const coffee: SearchFoodResult = {
  product_id: "demo-coffee",
  name: "Coffee with milk",
  producer: "Demo foods",
  nutrients: { kcal: 30, protein: 1, carbs: 3, fat: 1.3 },
  serving: serving100,
  base_unit: "ml",
  is_verified: true,
}

const chicken: SearchFoodResult = {
  product_id: "demo-chicken",
  name: "Chicken breast, grilled",
  producer: "Demo foods",
  nutrients: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  serving: serving100,
  base_unit: "g",
  is_verified: true,
}

/**
 * Demo mode: signs the session in without any YAZIO credentials and seeds
 * sample data so the app is explorable without an account. All ids are
 * stable (demo-*) so re-seeding never duplicates rows.
 */
export async function seedDemoSession(): Promise<void> {
  const db = await getDatabase()
  await setDemoLoggedIn()
  await updateSettings({ yazio_sync_enabled: 0, calorie_goal: 2000 })

  await saveFoodToCache(banana)
  await saveFoodToCache(oatmeal)
  await saveFoodToCache(coffee)
  await saveFoodToCache(chicken)

  const today = toDateKey()
  const yesterday = shiftDateKey(today, -1)

  await db.execAsync(`DELETE FROM diary_entries WHERE id LIKE 'demo-%'`)
  await addDiaryEntry({
    id: "demo-breakfast",
    date: today,
    meal_type: "breakfast",
    food_id: oatmeal.product_id,
    food_name: oatmeal.name,
    amount: 200,
    unit: "g",
    kcal: 142,
    protein: 5,
    carbs: 24,
    fat: 3,
    created_at: `${today}T07:30:00.000Z`,
  })
  await addDiaryEntry({
    id: "demo-coffee",
    date: today,
    meal_type: "breakfast",
    food_id: coffee.product_id,
    food_name: coffee.name,
    amount: 250,
    unit: "ml",
    kcal: 75,
    protein: 2.5,
    carbs: 7.5,
    fat: 3.3,
    created_at: `${today}T07:35:00.000Z`,
  })
  await addDiaryEntry({
    id: "demo-snack",
    date: today,
    meal_type: "snack",
    food_id: banana.product_id,
    food_name: banana.name,
    amount: 120,
    unit: "g",
    kcal: 107,
    protein: 1.3,
    carbs: 27.4,
    fat: 0.4,
    created_at: `${today}T15:10:00.000Z`,
  })
  await addDiaryEntry({
    id: "demo-yesterday",
    date: yesterday,
    meal_type: "lunch",
    food_id: chicken.product_id,
    food_name: chicken.name,
    amount: 150,
    unit: "g",
    kcal: 248,
    protein: 46.5,
    carbs: 0,
    fat: 5.4,
    created_at: `${yesterday}T12:00:00.000Z`,
  })

  await saveMeal({
    id: "demo-meal",
    name: "Chicken & banana (demo)",
    created_at: `${yesterday}T10:00:00.000Z`,
    updated_at: `${yesterday}T10:00:00.000Z`,
    items: [
      { ...chicken, amount: 150, nutrients: { kcal: 248, protein: 46.5, carbs: 0, fat: 5.4 } },
      { ...banana, amount: 120, nutrients: { kcal: 107, protein: 1.3, carbs: 27.4, fat: 0.4 } },
    ],
  })
}

export function isDemoQuery(): boolean {
  if (typeof window === "undefined") return false
  return new URLSearchParams(window.location.search).get("demo") === "1"
}
