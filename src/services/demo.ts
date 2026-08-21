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

  // Seed sample AI chat conversation
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
    "You've logged **75.8g of protein** so far today against your **150g daily goal** (51% complete). A balanced dinner with grilled salmon or chicken breast will easily close the remaining gap!",
    "",
    JSON.stringify([{ id: "call_demo_1", name: "get_today_summary" }]),
    null,
    null,
    0,
    nowIso,
  )

  const today = toDateKey()

  // 3. Seed 35 days of weight entries showing a steady, realistic downward trend
  // Starting at ~78.4 kg 34 days ago down to 75.2 kg today.
  const baseWeights = [
    78.4, 78.3, 78.5, 78.1, 78.0, 77.9, 78.1, 77.8, 77.6, 77.7, 77.4, 77.3, 77.5, 77.1, 76.9, 77.0,
    76.7, 76.6, 76.8, 76.4, 76.3, 76.5, 76.1, 76.0, 76.2, 75.9, 75.7, 75.8, 75.6, 75.5, 75.7, 75.4,
    75.5, 75.4, 75.2,
  ]

  for (let i = 34; i >= 0; i--) {
    const date = shiftDateKey(today, -i)
    const weightIndex = 34 - i
    const weightKg = baseWeights[weightIndex] ?? 75.2
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

  // 4. Seed 35 days of water hydration logs (~2300 - 2750 ml per past day, 1750 ml today)
  for (let i = 34; i >= 0; i--) {
    const date = shiftDateKey(today, -i)
    if (i === 0) {
      // Today: 1,750 ml logged so far
      await db.runAsync(
        "INSERT INTO water_log (id, date, amount_ml, created_at) VALUES (?, ?, ?, ?)",
        `demo-water-${date}-1`,
        date,
        500,
        `${date}T08:00:00.000Z`,
      )
      await db.runAsync(
        "INSERT INTO water_log (id, date, amount_ml, created_at) VALUES (?, ?, ?, ?)",
        `demo-water-${date}-2`,
        date,
        500,
        `${date}T12:30:00.000Z`,
      )
      await db.runAsync(
        "INSERT INTO water_log (id, date, amount_ml, created_at) VALUES (?, ?, ?, ?)",
        `demo-water-${date}-3`,
        date,
        750,
        `${date}T15:15:00.000Z`,
      )
    } else {
      // Past days: vary amounts around 2500ml
      const baseMl = 2400 + ((i * 37) % 350) - 100
      await db.runAsync(
        "INSERT INTO water_log (id, date, amount_ml, created_at) VALUES (?, ?, ?, ?)",
        `demo-water-${date}-1`,
        date,
        Math.round(baseMl * 0.4),
        `${date}T08:30:00.000Z`,
      )
      await db.runAsync(
        "INSERT INTO water_log (id, date, amount_ml, created_at) VALUES (?, ?, ?, ?)",
        `demo-water-${date}-2`,
        date,
        Math.round(baseMl * 0.35),
        `${date}T13:00:00.000Z`,
      )
      await db.runAsync(
        "INSERT INTO water_log (id, date, amount_ml, created_at) VALUES (?, ?, ?, ?)",
        `demo-water-${date}-3`,
        date,
        Math.round(baseMl * 0.25),
        `${date}T18:45:00.000Z`,
      )
    }
  }

  // 5. Seed 35 days of diary entries
  // Past days: breakfast, lunch, dinner, snack (~1920 - 2060 kcal, ~150g P, ~200g C, ~65g F)
  for (let i = 34; i >= 1; i--) {
    const date = shiftDateKey(today, -i)

    // Breakfast: Oatmeal (200g) + Eggs (120g) + Coffee (250ml) -> ~396 kcal
    await addDiaryEntry({
      id: `demo-entry-${date}-b1`,
      date,
      meal_type: "breakfast",
      food_id: oatmeal.product_id,
      food_name: oatmeal.name,
      amount: 200,
      unit: "g",
      kcal: 142,
      protein: 5.0,
      carbs: 24.0,
      fat: 3.0,
      created_at: `${date}T07:30:00.000Z`,
    })
    await addDiaryEntry({
      id: `demo-entry-${date}-b2`,
      date,
      meal_type: "breakfast",
      food_id: eggs.product_id,
      food_name: eggs.name,
      amount: 120,
      unit: "g",
      kcal: 179,
      protein: 12.0,
      carbs: 1.9,
      fat: 13.2,
      created_at: `${date}T07:35:00.000Z`,
    })
    await addDiaryEntry({
      id: `demo-entry-${date}-b3`,
      date,
      meal_type: "breakfast",
      food_id: coffee.product_id,
      food_name: coffee.name,
      amount: 250,
      unit: "ml",
      kcal: 75,
      protein: 2.5,
      carbs: 7.5,
      fat: 3.3,
      created_at: `${date}T07:40:00.000Z`,
    })

    // Lunch: Chicken (170g) + Brown Rice (160g) + Broccoli (120g) -> ~502 kcal
    await addDiaryEntry({
      id: `demo-entry-${date}-l1`,
      date,
      meal_type: "lunch",
      food_id: chicken.product_id,
      food_name: chicken.name,
      amount: 170,
      unit: "g",
      kcal: 281,
      protein: 52.7,
      carbs: 0,
      fat: 6.1,
      created_at: `${date}T12:15:00.000Z`,
    })
    await addDiaryEntry({
      id: `demo-entry-${date}-l2`,
      date,
      meal_type: "lunch",
      food_id: brownRice.product_id,
      food_name: brownRice.name,
      amount: 160,
      unit: "g",
      kcal: 179,
      protein: 4.2,
      carbs: 37.6,
      fat: 1.4,
      created_at: `${date}T12:15:00.000Z`,
    })
    await addDiaryEntry({
      id: `demo-entry-${date}-l3`,
      date,
      meal_type: "lunch",
      food_id: broccoli.product_id,
      food_name: broccoli.name,
      amount: 120,
      unit: "g",
      kcal: 42,
      protein: 2.9,
      carbs: 8.6,
      fat: 0.5,
      created_at: `${date}T12:15:00.000Z`,
    })

    // Dinner: Salmon (170g) + Toast (76g) + Avocado (75g) -> ~660 kcal
    await addDiaryEntry({
      id: `demo-entry-${date}-d1`,
      date,
      meal_type: "dinner",
      food_id: salmon.product_id,
      food_name: salmon.name,
      amount: 170,
      unit: "g",
      kcal: 350,
      protein: 37.4,
      carbs: 0,
      fat: 20.9,
      created_at: `${date}T19:00:00.000Z`,
    })
    await addDiaryEntry({
      id: `demo-entry-${date}-d2`,
      date,
      meal_type: "dinner",
      food_id: toast.product_id,
      food_name: toast.name,
      amount: 76,
      unit: "g",
      kcal: 190,
      protein: 8.4,
      carbs: 32.7,
      fat: 2.7,
      created_at: `${date}T19:00:00.000Z`,
    })
    await addDiaryEntry({
      id: `demo-entry-${date}-d3`,
      date,
      meal_type: "dinner",
      food_id: avocado.product_id,
      food_name: avocado.name,
      amount: 75,
      unit: "g",
      kcal: 120,
      protein: 1.5,
      carbs: 6.4,
      fat: 11.0,
      created_at: `${date}T19:00:00.000Z`,
    })

    // Snack: Greek Yogurt (150g) + Blueberries (50g) + Banana (120g) + Whey (30g) -> ~438 kcal
    await addDiaryEntry({
      id: `demo-entry-${date}-s1`,
      date,
      meal_type: "snack",
      food_id: greekYogurt.product_id,
      food_name: greekYogurt.name,
      amount: 150,
      unit: "g",
      kcal: 89,
      protein: 15.0,
      carbs: 5.4,
      fat: 0.3,
      created_at: `${date}T15:30:00.000Z`,
    })
    await addDiaryEntry({
      id: `demo-entry-${date}-s2`,
      date,
      meal_type: "snack",
      food_id: blueberries.product_id,
      food_name: blueberries.name,
      amount: 50,
      unit: "g",
      kcal: 29,
      protein: 0.4,
      carbs: 7.3,
      fat: 0.2,
      created_at: `${date}T15:30:00.000Z`,
    })
    await addDiaryEntry({
      id: `demo-entry-${date}-s3`,
      date,
      meal_type: "snack",
      food_id: banana.product_id,
      food_name: banana.name,
      amount: 120,
      unit: "g",
      kcal: 107,
      protein: 1.3,
      carbs: 27.4,
      fat: 0.4,
      created_at: `${date}T15:30:00.000Z`,
    })
    await addDiaryEntry({
      id: `demo-entry-${date}-s4`,
      date,
      meal_type: "snack",
      food_id: wheyProtein.product_id,
      food_name: wheyProtein.name,
      amount: 30,
      unit: "g",
      kcal: 114,
      protein: 23.1,
      carbs: 1.5,
      fat: 1.1,
      created_at: `${date}T15:30:00.000Z`,
    })
  }

  // Today (day 0): Log breakfast, lunch, and snack totaling 1,185 kcal.
  // Dinner is left unlogged so the dashboard shows healthy progress and remaining budget.
  await addDiaryEntry({
    id: "demo-breakfast",
    date: today,
    meal_type: "breakfast",
    food_id: oatmeal.product_id,
    food_name: oatmeal.name,
    amount: 200,
    unit: "g",
    kcal: 142,
    protein: 5.0,
    carbs: 24.0,
    fat: 3.0,
    created_at: `${today}T07:30:00.000Z`,
  })
  await addDiaryEntry({
    id: "demo-eggs-today",
    date: today,
    meal_type: "breakfast",
    food_id: eggs.product_id,
    food_name: eggs.name,
    amount: 150,
    unit: "g",
    kcal: 224,
    protein: 15.0,
    carbs: 2.4,
    fat: 16.5,
    created_at: `${today}T07:32:00.000Z`,
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
    id: "demo-lunch-chicken",
    date: today,
    meal_type: "lunch",
    food_id: chicken.product_id,
    food_name: chicken.name,
    amount: 180,
    unit: "g",
    kcal: 297,
    protein: 55.8,
    carbs: 0,
    fat: 6.5,
    created_at: `${today}T12:30:00.000Z`,
  })
  await addDiaryEntry({
    id: "demo-lunch-rice",
    date: today,
    meal_type: "lunch",
    food_id: brownRice.product_id,
    food_name: brownRice.name,
    amount: 150,
    unit: "g",
    kcal: 168,
    protein: 3.9,
    carbs: 35.3,
    fat: 1.4,
    created_at: `${today}T12:30:00.000Z`,
  })
  await addDiaryEntry({
    id: "demo-lunch-broccoli",
    date: today,
    meal_type: "lunch",
    food_id: broccoli.product_id,
    food_name: broccoli.name,
    amount: 100,
    unit: "g",
    kcal: 35,
    protein: 2.4,
    carbs: 7.2,
    fat: 0.4,
    created_at: `${today}T12:30:00.000Z`,
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
    id: "demo-snack-yogurt",
    date: today,
    meal_type: "snack",
    food_id: greekYogurt.product_id,
    food_name: greekYogurt.name,
    amount: 150,
    unit: "g",
    kcal: 89,
    protein: 15.0,
    carbs: 5.4,
    fat: 0.3,
    created_at: `${today}T15:10:00.000Z`,
  })
  await addDiaryEntry({
    id: "demo-snack-berries",
    date: today,
    meal_type: "snack",
    food_id: blueberries.product_id,
    food_name: blueberries.name,
    amount: 80,
    unit: "g",
    kcal: 46,
    protein: 0.6,
    carbs: 11.6,
    fat: 0.2,
    created_at: `${today}T15:10:00.000Z`,
  })

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
