import type { FoodNutrients, FoodServing, Meal, MealItem } from '@/types';
import { getDatabase } from './database';
import { parseJson } from '@/utils/json';

type MealRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
};

type MealItemRow = {
  meal_id: string;
  position: number;
  product_id: string;
  name: string;
  producer: string | null;
  amount: number;
  base_unit: string;
  nutrients_json: string;
  serving_json: string;
};

function rowToMealItem(row: MealItemRow): MealItem | null {
  const nutrients = parseJson<FoodNutrients>(row.nutrients_json);
  const serving = parseJson<FoodServing>(row.serving_json);
  if (!nutrients || !serving || !row.product_id) return null;
  return {
    product_id: row.product_id,
    name: row.name,
    producer: row.producer ?? '',
    amount: Number(row.amount),
    base_unit: row.base_unit || 'g',
    nutrients,
    serving,
  };
}

function toMeal(meal: MealRow, itemRows: MealItemRow[]): Meal {
  const items: MealItem[] = [];
  for (const row of itemRows) {
    const item = rowToMealItem(row);
    if (item) items.push(item);
  }
  return {
    id: meal.id,
    name: meal.name,
    created_at: meal.created_at,
    updated_at: meal.updated_at,
    last_used_at: meal.last_used_at,
    items,
  };
}

export async function getMeals(): Promise<Meal[]> {
  const db = await getDatabase();
  const meals = await db.getAllAsync<MealRow>(
    `SELECT * FROM meals
     ORDER BY last_used_at IS NULL, last_used_at DESC, name COLLATE NOCASE ASC`,
  );
  const items = await db.getAllAsync<MealItemRow>(
    'SELECT * FROM meal_items ORDER BY position ASC',
  );
  const itemsByMeal = new Map<string, MealItemRow[]>();
  for (const row of items) {
    const list = itemsByMeal.get(row.meal_id);
    if (list) list.push(row);
    else itemsByMeal.set(row.meal_id, [row]);
  }
  return meals.map((meal) => toMeal(meal, itemsByMeal.get(meal.id) ?? []));
}

export async function getMealById(id: string): Promise<Meal | null> {
  const db = await getDatabase();
  const meal = await db.getFirstAsync<MealRow>(
    'SELECT * FROM meals WHERE id = ?',
    id,
  );
  if (!meal) return null;
  const items = await db.getAllAsync<MealItemRow>(
    'SELECT * FROM meal_items WHERE meal_id = ? ORDER BY position ASC',
    id,
  );
  return toMeal(meal, items);
}

/** Insert or update a meal and replace its items atomically. */
export async function saveMeal(
  meal: {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
    items: MealItem[];
  },
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM meals WHERE id = ?',
    meal.id,
  );
  await db.withTransactionAsync(async () => {
    if (existing) {
      await db.runAsync(
        'UPDATE meals SET name = ?, updated_at = ? WHERE id = ?',
        meal.name.trim(),
        meal.updated_at,
        meal.id,
      );
    } else {
      await db.runAsync(
        'INSERT INTO meals (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
        meal.id,
        meal.name.trim(),
        meal.created_at,
        meal.updated_at,
      );
    }
    await db.runAsync('DELETE FROM meal_items WHERE meal_id = ?', meal.id);
    for (const [position, item] of meal.items.entries()) {
      await db.runAsync(
        `INSERT INTO meal_items (
          meal_id, position, product_id, name, producer, amount, base_unit,
          nutrients_json, serving_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        meal.id,
        position,
        item.product_id,
        item.name,
        item.producer,
        item.amount,
        item.base_unit,
        JSON.stringify(item.nutrients),
        JSON.stringify(item.serving),
      );
    }
  });
}

export async function deleteMeal(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM meal_items WHERE meal_id = ?', id);
    await db.runAsync('DELETE FROM meals WHERE id = ?', id);
  });
}

export async function touchMealUsed(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE meals SET updated_at = ?, last_used_at = ? WHERE id = ?',
    new Date().toISOString(),
    new Date().toISOString(),
    id,
  );
}
