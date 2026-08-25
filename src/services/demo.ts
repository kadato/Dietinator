import { getDatabase } from "@/db/database"
import { saveFoodToCache } from "@/db/food-cache"
import { addDiaryEntry } from "@/db/diary"
import { saveMeal } from "@/db/meals"
import { updateSettings } from "@/db/settings"
import { toDateKey, shiftDateKey } from "@/utils/date"
import { setDemoLoggedIn } from "@/services/yazio/auth-storage"
import type { FoodServing, SearchFoodResult } from "@/types"

const serving100g: FoodServing = { serving: "100 g", amount: 100, serving_quantity: 100 }
const serving100ml: FoodServing = { serving: "100 ml", amount: 100, serving_quantity: 100 }

/**
 * Deterministic PRNG (mulberry32). Demo data must look organic but seed
 * identically on every run: stable `demo-*` row IDs, reproducible charts,
 * and predictable e2e fixtures all depend on it.
 */
function createRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round1 = (value: number): number => Math.round(value * 10) / 10

/** Scale a food's per-100g nutrients to a logged amount. */
function nutrientsFor(food: SearchFoodResult, amount: number) {
  const factor = amount / 100
  return {
    kcal: Math.round(food.nutrients.kcal * factor),
    protein: round1(food.nutrients.protein * factor),
    carbs: round1(food.nutrients.carbs * factor),
    fat: round1(food.nutrients.fat * factor),
  }
}

/** A food with the realistic portion range it gets logged in. */
type Portion = { food: SearchFoodResult; min: number; max: number; step: number }
type MealTemplate = Portion[]

function pickAmount(rand: () => number, portion: Portion): number {
  const steps = Math.max(0, Math.round((portion.max - portion.min) / portion.step))
  return Math.round(portion.min + Math.round(rand() * steps) * portion.step)
}

function pickTemplate(rand: () => number, templates: MealTemplate[]): MealTemplate {
  return templates[Math.floor(rand() * templates.length)]
}

/** Minute-of-hour jitter so meal timestamps do not all read :00. */
function pickMinute(rand: () => number): string {
  return String(Math.floor(rand() * 12) * 5).padStart(2, "0")
}

const banana: SearchFoodResult = {
  product_id: "demo-banana",
  name: "Banana",
  producer: "Fresh Fruit",
  nutrients: {
    kcal: 89,
    protein: 1.1,
    carbs: 22.8,
    fat: 0.3,
    fiber: 2.6,
    sugar: 12.2,
    potassium: 358,
    vitamin_c: 8.7,
  },
  serving: serving100g,
  servings: [
    serving100g,
    { serving: "1 medium (118g)", amount: 118, serving_quantity: 118 },
    { serving: "1 large (136g)", amount: 136, serving_quantity: 136 },
    { serving: "1 small (101g)", amount: 101, serving_quantity: 101 },
  ],
  base_unit: "g",
  is_verified: true,
  last_amount: 120,
}

const oatmeal: SearchFoodResult = {
  product_id: "demo-oatmeal",
  name: "Oatmeal, cooked",
  producer: "Whole Grains",
  nutrients: {
    kcal: 71,
    protein: 2.5,
    carbs: 12,
    fat: 1.5,
    fiber: 1.7,
    sugar: 0.3,
    magnesium: 27,
    iron: 1.1,
  },
  serving: serving100g,
  servings: [
    serving100g,
    { serving: "1 bowl (240g)", amount: 240, serving_quantity: 240 },
    { serving: "1 cup (234g)", amount: 234, serving_quantity: 234 },
  ],
  base_unit: "g",
  is_verified: true,
  last_amount: 200,
}

const coffee: SearchFoodResult = {
  product_id: "demo-coffee",
  name: "Coffee with milk",
  producer: "Café",
  nutrients: {
    kcal: 30,
    protein: 1.0,
    carbs: 3.0,
    fat: 1.3,
    calcium: 35,
  },
  serving: serving100ml,
  servings: [
    serving100ml,
    { serving: "1 cup (240ml)", amount: 240, serving_quantity: 240 },
    { serving: "1 mug (350ml)", amount: 350, serving_quantity: 350 },
  ],
  base_unit: "ml",
  is_verified: true,
  last_amount: 250,
}

const chicken: SearchFoodResult = {
  product_id: "demo-chicken",
  name: "Chicken breast, grilled",
  producer: "Butcher's Cut",
  nutrients: {
    kcal: 165,
    protein: 31.0,
    carbs: 0,
    fat: 3.6,
    saturated_fat: 1.0,
    sodium: 74,
    potassium: 256,
  },
  serving: serving100g,
  servings: [
    serving100g,
    { serving: "1 fillet (170g)", amount: 170, serving_quantity: 170 },
    { serving: "1 portion (150g)", amount: 150, serving_quantity: 150 },
  ],
  base_unit: "g",
  is_verified: true,
  last_amount: 180,
}

const brownRice: SearchFoodResult = {
  product_id: "demo-rice",
  name: "Brown rice, cooked",
  producer: "Whole Grains",
  nutrients: {
    kcal: 112,
    protein: 2.6,
    carbs: 23.5,
    fat: 0.9,
    fiber: 1.8,
    magnesium: 43,
  },
  serving: serving100g,
  servings: [
    serving100g,
    { serving: "1 cup (195g)", amount: 195, serving_quantity: 195 },
    { serving: "1 portion (150g)", amount: 150, serving_quantity: 150 },
  ],
  base_unit: "g",
  is_verified: true,
  last_amount: 150,
}

const broccoli: SearchFoodResult = {
  product_id: "demo-broccoli",
  name: "Steamed broccoli",
  producer: "Fresh Market",
  nutrients: {
    kcal: 35,
    protein: 2.4,
    carbs: 7.2,
    fat: 0.4,
    fiber: 3.3,
    vitamin_c: 65,
    calcium: 40,
  },
  serving: serving100g,
  servings: [
    serving100g,
    { serving: "1 cup florets (91g)", amount: 91, serving_quantity: 91 },
    { serving: "1 serving (150g)", amount: 150, serving_quantity: 150 },
  ],
  base_unit: "g",
  is_verified: true,
  last_amount: 100,
}

const greekYogurt: SearchFoodResult = {
  product_id: "demo-yogurt",
  name: "Greek yogurt 0%",
  producer: "Dairy Best",
  nutrients: {
    kcal: 59,
    protein: 10.0,
    carbs: 3.6,
    fat: 0.2,
    calcium: 110,
  },
  serving: serving100g,
  servings: [
    serving100g,
    { serving: "1 cup (200g)", amount: 200, serving_quantity: 200 },
    { serving: "1 pot (150g)", amount: 150, serving_quantity: 150 },
  ],
  base_unit: "g",
  is_verified: true,
  last_amount: 150,
}

const blueberries: SearchFoodResult = {
  product_id: "demo-blueberries",
  name: "Fresh blueberries",
  producer: "Berry Farm",
  nutrients: {
    kcal: 57,
    protein: 0.7,
    carbs: 14.5,
    fat: 0.3,
    fiber: 2.4,
    vitamin_c: 9.7,
  },
  serving: serving100g,
  servings: [
    serving100g,
    { serving: "1 handful (50g)", amount: 50, serving_quantity: 50 },
    { serving: "1 cup (148g)", amount: 148, serving_quantity: 148 },
  ],
  base_unit: "g",
  is_verified: true,
  last_amount: 50,
}

const eggs: SearchFoodResult = {
  product_id: "demo-eggs",
  name: "Scrambled eggs",
  producer: "Farm Fresh",
  nutrients: {
    kcal: 149,
    protein: 10.0,
    carbs: 1.6,
    fat: 11.0,
    vitamin_d: 1.8,
    iron: 1.4,
  },
  serving: serving100g,
  servings: [
    serving100g,
    { serving: "2 large eggs (120g)", amount: 120, serving_quantity: 120 },
    { serving: "3 large eggs (180g)", amount: 180, serving_quantity: 180 },
  ],
  base_unit: "g",
  is_verified: true,
  last_amount: 150,
}

const salmon: SearchFoodResult = {
  product_id: "demo-salmon",
  name: "Atlantic salmon, baked",
  producer: "Ocean Catch",
  nutrients: {
    kcal: 206,
    protein: 22.0,
    carbs: 0,
    fat: 12.3,
    unsaturated_fat: 8.5,
    potassium: 384,
  },
  serving: serving100g,
  servings: [serving100g, { serving: "1 fillet (170g)", amount: 170, serving_quantity: 170 }],
  base_unit: "g",
  is_verified: true,
  last_amount: 160,
}

const wheyProtein: SearchFoodResult = {
  product_id: "demo-whey",
  name: "Whey protein powder (Vanilla)",
  producer: "Optimum Nutrition",
  nutrients: {
    kcal: 380,
    protein: 77.0,
    carbs: 5.0,
    fat: 3.5,
    calcium: 140,
  },
  serving: serving100g,
  servings: [serving100g, { serving: "1 scoop (30g)", amount: 30, serving_quantity: 30 }],
  base_unit: "g",
  is_verified: true,
  last_amount: 30,
}

const avocado: SearchFoodResult = {
  product_id: "demo-avocado",
  name: "Avocado",
  producer: "Fresh Market",
  nutrients: {
    kcal: 160,
    protein: 2.0,
    carbs: 8.5,
    fat: 14.7,
    fiber: 6.7,
    potassium: 485,
  },
  serving: serving100g,
  servings: [
    serving100g,
    { serving: "1/2 avocado (75g)", amount: 75, serving_quantity: 75 },
    { serving: "1 whole (150g)", amount: 150, serving_quantity: 150 },
  ],
  base_unit: "g",
  is_verified: true,
  last_amount: 75,
}

const toast: SearchFoodResult = {
  product_id: "demo-toast",
  name: "Whole wheat bread toast",
  producer: "Bakery",
  nutrients: {
    kcal: 250,
    protein: 11.0,
    carbs: 43.0,
    fat: 3.5,
    fiber: 6.0,
  },
  serving: serving100g,
  servings: [
    serving100g,
    { serving: "1 slice (38g)", amount: 38, serving_quantity: 38 },
    { serving: "2 slices (76g)", amount: 76, serving_quantity: 76 },
  ],
  base_unit: "g",
  is_verified: true,
  last_amount: 76,
}

const ALL_DEMO_FOODS: SearchFoodResult[] = [
  banana,
  oatmeal,
  coffee,
  chicken,
  brownRice,
  broccoli,
  greekYogurt,
  blueberries,
  eggs,
  salmon,
  wheyProtein,
  avocado,
  toast,
]

/**
 * Demo mode: signs the session in without any YAZIO credentials and seeds
 * realistic 35-day historical sample data so the dashboard, stats trends,
 * charts, and food search are fully populated and explorable.
 * All IDs are stable (`demo-*`) so re-seeding never duplicates rows.
 */
export async function seedDemoSession(): Promise<void> {
  const db = await getDatabase()
  await setDemoLoggedIn()

  await updateSettings({
    yazio_sync_enabled: 0,
    calorie_goal: 2000,
    protein_goal: 150,
    carbs_goal: 200,
    fat_goal: 65,
    water_goal_ml: 2500,
    height_cm: 180,
    target_weight_kg: 74.0,
    units: "metric",
    ai_enabled: 1,
    ai_provider: "openai",
    ai_model: "gpt-4o-mini",
  })

  // 1. Cache all demo foods
  for (const food of ALL_DEMO_FOODS) {
    await saveFoodToCache(food)
  }

  // Mark top items as favorites
  const favoriteIds = [
    banana.product_id,
    oatmeal.product_id,
    chicken.product_id,
    greekYogurt.product_id,
    eggs.product_id,
    salmon.product_id,
  ]
  for (let i = 0; i < favoriteIds.length; i++) {
    await db.runAsync(
      "UPDATE food_cache SET is_favorite = 1, favorite_order = ? WHERE yazio_product_id = ?",
      i + 1,
      favoriteIds[i],
    )
  }

  // 2. Clean previous demo records
  await db.execAsync(`
    DELETE FROM diary_entries WHERE id LIKE 'demo-%';
    DELETE FROM weight_entries WHERE id LIKE 'demo-%';
    DELETE FROM water_log WHERE id LIKE 'demo-%';
    DELETE FROM meals WHERE id LIKE 'demo-%';
    DELETE FROM meal_items WHERE meal_id LIKE 'demo-%';
    DELETE FROM ai_chat_messages;
  `)

  const today = toDateKey()

  // One PRNG drives the whole seed, so the data is varied per day yet
  // identical across runs.
  const rand = createRandom(0x0d1e7)

  // 3. Seed 35 days of weight entries: downward trend from ~78.4 kg to
  // 75.2 kg with per-day noise, so the trend chart shows a realistic,
  // non-linear descent.
  for (let i = 34; i >= 0; i--) {
    const date = shiftDateKey(today, -i)
    const progress = (34 - i) / 34
    const base = 78.4 + (75.2 - 78.4) * progress
    const weightKg = i === 0 ? 75.2 : Math.round((base + (rand() - 0.5) * 0.6) * 10) / 10
    let note: string | null = null
    if (i === 34) note = "Starting check-in"
    else if (i === 21) note = "Weekly low"
    else if (i === 14) note = "Feeling energetic"
    else if (i === 7) note = "Weekly check-in"
    else if (i === 0) note = "Morning fasted"

    await db.runAsync(
      `INSERT INTO weight_entries (id, date, weight_kg, note, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET weight_kg = excluded.weight_kg, note = excluded.note`,
      `demo-weight-${date}`,
      date,
      weightKg,
      note,
      `${date}T07:00:00.000Z`,
    )
  }

  // 4. Seed 35 days of water logs. Past days land between 2.1 L and 2.95 L,
  // split across 2-4 pours at varied times; today sits at 1.75 L so the
  // dashboard shows mid-progress hydration.
  const pourHours = [8, 11, 14, 17, 20]
  for (let i = 34; i >= 0; i--) {
    const date = shiftDateKey(today, -i)
    if (i === 0) {
      const todayPours: [number, string][] = [
        [500, "08:00"],
        [500, "12:30"],
        [750, "15:15"],
      ]
      for (let p = 0; p < todayPours.length; p++) {
        await db.runAsync(
          "INSERT INTO water_log (id, date, amount_ml, created_at) VALUES (?, ?, ?, ?)",
          `demo-water-${date}-${p + 1}`,
          date,
          todayPours[p][0],
          `${date}T${todayPours[p][1]}:00.000Z`,
        )
      }
      continue
    }
    const totalMl = 2100 + Math.round(rand() * 17) * 50
    const pourCount = rand() < 0.3 ? 4 : rand() < 0.6 ? 3 : 2
    const weights = Array.from({ length: pourCount }, () => 0.6 + rand())
    const weightSum = weights.reduce((sum, w) => sum + w, 0)
    const hourOffsets = Array.from({ length: pourCount }, () =>
      Math.floor(rand() * pourHours.length),
    )
    let loggedMl = 0
    for (let p = 0; p < pourCount; p++) {
      const isLast = p === pourCount - 1
      const amount = isLast
        ? Math.round((totalMl - loggedMl) / 50) * 50
        : Math.round((totalMl * weights[p]) / weightSum / 50) * 50
      loggedMl += amount
      const hour = pourHours[(hourOffsets[p] + p) % pourHours.length]
      await db.runAsync(
        "INSERT INTO water_log (id, date, amount_ml, created_at) VALUES (?, ?, ?, ?)",
        `demo-water-${date}-${p + 1}`,
        date,
        Math.max(amount, 50),
        `${date}T${String(hour).padStart(2, "0")}:${pickMinute(rand)}:00.000Z`,
      )
    }
  }

  // 5. Seed 35 days of diary entries. Each day draws its breakfast, lunch,
  // dinner, and snack from rotating whole-food templates with jittered
  // portion sizes, and nutrients are computed from the food's per-100g
  // values, so no two days are identical.
  const BREAKFASTS: MealTemplate[] = [
    [
      { food: oatmeal, min: 150, max: 250, step: 10 },
      { food: eggs, min: 100, max: 150, step: 5 },
      { food: coffee, min: 200, max: 300, step: 10 },
    ],
    [
      { food: greekYogurt, min: 150, max: 250, step: 10 },
      { food: blueberries, min: 40, max: 80, step: 10 },
      { food: toast, min: 60, max: 90, step: 5 },
      { food: coffee, min: 200, max: 300, step: 10 },
    ],
    [
      { food: oatmeal, min: 150, max: 250, step: 10 },
      { food: banana, min: 90, max: 140, step: 10 },
      { food: coffee, min: 200, max: 300, step: 10 },
    ],
    [
      { food: eggs, min: 100, max: 150, step: 5 },
      { food: toast, min: 60, max: 90, step: 5 },
      { food: coffee, min: 200, max: 300, step: 10 },
    ],
  ]
  const LUNCHES: MealTemplate[] = [
    [
      { food: chicken, min: 140, max: 200, step: 10 },
      { food: brownRice, min: 140, max: 200, step: 10 },
      { food: broccoli, min: 80, max: 150, step: 10 },
    ],
    [
      { food: salmon, min: 120, max: 180, step: 10 },
      { food: brownRice, min: 140, max: 200, step: 10 },
      { food: broccoli, min: 80, max: 150, step: 10 },
    ],
    [
      { food: chicken, min: 140, max: 200, step: 10 },
      { food: toast, min: 60, max: 90, step: 5 },
      { food: avocado, min: 50, max: 100, step: 10 },
    ],
  ]
  const DINNERS: MealTemplate[] = [
    [
      { food: salmon, min: 120, max: 180, step: 10 },
      { food: toast, min: 60, max: 90, step: 5 },
      { food: avocado, min: 50, max: 100, step: 10 },
    ],
    [
      { food: chicken, min: 140, max: 200, step: 10 },
      { food: brownRice, min: 140, max: 200, step: 10 },
      { food: broccoli, min: 80, max: 150, step: 10 },
    ],
    [
      { food: salmon, min: 120, max: 180, step: 10 },
      { food: brownRice, min: 140, max: 200, step: 10 },
      { food: broccoli, min: 80, max: 150, step: 10 },
    ],
  ]
  const SNACKS: MealTemplate[] = [
    [
      { food: greekYogurt, min: 120, max: 200, step: 10 },
      { food: blueberries, min: 40, max: 80, step: 10 },
    ],
    [
      { food: banana, min: 90, max: 140, step: 10 },
      { food: wheyProtein, min: 25, max: 40, step: 5 },
    ],
    [
      { food: greekYogurt, min: 120, max: 200, step: 10 },
      { food: banana, min: 90, max: 140, step: 10 },
    ],
    [{ food: banana, min: 90, max: 140, step: 10 }],
  ]
  const MEAL_TIMES: Record<string, string> = {
    breakfast: "07",
    lunch: "12",
    dinner: "19",
    snack: "15",
  }

  async function logTemplateMeal(
    date: string,
    mealType: "breakfast" | "lunch" | "dinner" | "snack",
    template: MealTemplate,
  ): Promise<void> {
    const minute = pickMinute(rand)
    for (let item = 0; item < template.length; item++) {
      const portion = template[item]
      const amount = pickAmount(rand, portion)
      const nutrients = nutrientsFor(portion.food, amount)
      await addDiaryEntry({
        id: `demo-entry-${date}-${mealType[0]}${item + 1}`,
        date,
        meal_type: mealType,
        food_id: portion.food.product_id,
        food_name: portion.food.name,
        amount,
        unit: portion.food.base_unit,
        ...nutrients,
        created_at: `${date}T${MEAL_TIMES[mealType]}:${item === 0 ? minute : pickMinute(rand)}:00.000Z`,
      })
    }
  }

  // Past days: every day logs something (the 35-day streak stays honest) but
  // the mix rotates. About one day in nine skips the afternoon snack, and a
  // handful of days skip dinner, like real logging behavior.
  for (let i = 34; i >= 1; i--) {
    const date = shiftDateKey(today, -i)
    await logTemplateMeal(date, "breakfast", pickTemplate(rand, BREAKFASTS))
    await logTemplateMeal(date, "lunch", pickTemplate(rand, LUNCHES))
    if (rand() > 0.12) await logTemplateMeal(date, "snack", pickTemplate(rand, SNACKS))
    if (rand() > 0.08) await logTemplateMeal(date, "dinner", pickTemplate(rand, DINNERS))
  }

  // Today: fixed, recognizable meals. Breakfast and the snack keep oatmeal
  // and banana (e2e fixtures key on them); dinner is left unlogged so the
  // dashboard shows healthy progress and a remaining budget.
  const todayMeals: {
    id: string
    meal_type: "breakfast" | "lunch" | "dinner" | "snack"
    food: SearchFoodResult
    amount: number
    time: string
  }[] = [
    { id: "demo-breakfast", meal_type: "breakfast", food: oatmeal, amount: 200, time: "07:30" },
    { id: "demo-eggs-today", meal_type: "breakfast", food: eggs, amount: 150, time: "07:32" },
    { id: "demo-coffee", meal_type: "breakfast", food: coffee, amount: 250, time: "07:35" },
    {
      id: "demo-lunch-chicken",
      meal_type: "lunch",
      food: chicken,
      amount: 180,
      time: "12:30",
    },
    { id: "demo-lunch-rice", meal_type: "lunch", food: brownRice, amount: 150, time: "12:30" },
    {
      id: "demo-lunch-broccoli",
      meal_type: "lunch",
      food: broccoli,
      amount: 100,
      time: "12:30",
    },
    { id: "demo-snack", meal_type: "snack", food: banana, amount: 120, time: "15:10" },
    { id: "demo-snack-yogurt", meal_type: "snack", food: greekYogurt, amount: 150, time: "15:10" },
    { id: "demo-snack-berries", meal_type: "snack", food: blueberries, amount: 80, time: "15:10" },
  ]
  let todayProtein = 0
  for (const meal of todayMeals) {
    const nutrients = nutrientsFor(meal.food, meal.amount)
    todayProtein += nutrients.protein
    await addDiaryEntry({
      id: meal.id,
      date: today,
      meal_type: meal.meal_type,
      food_id: meal.food.product_id,
      food_name: meal.food.name,
      amount: meal.amount,
      unit: meal.food.base_unit,
      ...nutrients,
      created_at: `${today}T${meal.time}:00.000Z`,
    })
  }

  // Seed a sample AI chat conversation whose numbers match today's real
  // seeded totals.
  const proteinLogged = round1(todayProtein)
  const proteinPct = Math.round((proteinLogged / 150) * 100)
  const nowIso = new Date().toISOString()
  await db.runAsync(
    `INSERT INTO ai_chat_messages (role, content, reasoning, tool_calls_json, tool_call_id, tool_name, is_error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    "user",
    "How am I tracking towards my protein goal today?",
    "",
    null,
    null,
    null,
    0,
    nowIso,
  )
  await db.runAsync(
    `INSERT INTO ai_chat_messages (role, content, reasoning, tool_calls_json, tool_call_id, tool_name, is_error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    "assistant",
    `You've logged **${proteinLogged}g of protein** so far today against your **150g daily goal** (${proteinPct}% complete). A balanced dinner with grilled salmon or chicken breast will easily close the remaining gap!`,
    "",
    JSON.stringify([{ id: "call_demo_1", name: "get_today_summary" }]),
    null,
    null,
    0,
    nowIso,
  )

  // 6. Seed saved reusable meals
  const yesterday = shiftDateKey(today, -1)
  await saveMeal({
    id: "demo-meal-powerbowl",
    name: "Morning Power Bowl",
    created_at: `${yesterday}T08:00:00.000Z`,
    updated_at: `${yesterday}T08:00:00.000Z`,
    items: [
      { ...oatmeal, amount: 200, nutrients: { kcal: 142, protein: 5.0, carbs: 24.0, fat: 3.0 } },
      { ...greekYogurt, amount: 150, nutrients: { kcal: 89, protein: 15.0, carbs: 5.4, fat: 0.3 } },
      { ...blueberries, amount: 50, nutrients: { kcal: 29, protein: 0.4, carbs: 7.3, fat: 0.2 } },
      { ...wheyProtein, amount: 30, nutrients: { kcal: 114, protein: 23.1, carbs: 1.5, fat: 1.1 } },
    ],
  })

  await saveMeal({
    id: "demo-meal-chickenrice",
    name: "Post-Workout Chicken and Rice",
    created_at: `${yesterday}T13:00:00.000Z`,
    updated_at: `${yesterday}T13:00:00.000Z`,
    items: [
      { ...chicken, amount: 180, nutrients: { kcal: 297, protein: 55.8, carbs: 0, fat: 6.5 } },
      { ...brownRice, amount: 160, nutrients: { kcal: 179, protein: 4.2, carbs: 37.6, fat: 1.4 } },
      { ...broccoli, amount: 120, nutrients: { kcal: 42, protein: 2.9, carbs: 8.6, fat: 0.5 } },
    ],
  })
}

export function isDemoQuery(): boolean {
  if (typeof window === "undefined") return false
  return new URLSearchParams(window.location.search).get("demo") === "1"
}
