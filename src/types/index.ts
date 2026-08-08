export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface DiaryEntry {
  id: string;
  date: string;
  meal_type: MealType;
  food_id: string | null;
  food_name: string;
  amount: number;
  unit: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
  yazio_synced: number;
  yazio_item_id: string | null;
}

export interface CachedFood {
  yazio_product_id: string;
  barcode: string | null;
  name: string;
  producer: string | null;
  nutrients_json: string;
  serving_json: string;
  base_unit: string;
  cached_at: string;
  is_favorite: number;
  last_used_at: string | null;
}

export interface AppSettings {
  calorie_goal: number;
  protein_goal: number;
  carbs_goal: number;
  fat_goal: number;
  units: string;
  yazio_sync_enabled: number;
  /** YAZIO profile `food_database_country` — used for product search. */
  food_database_country: string;
  /** Auto-check GitHub releases for a newer app version on startup. */
  update_check_enabled: number;
}

export interface FoodNutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodServing {
  serving: string;
  amount: number;
  serving_quantity: number;
}

export interface SearchFoodResult {
  product_id: string;
  name: string;
  producer: string;
  nutrients: FoodNutrients;
  serving: FoodServing;
  /** All serving options from YAZIO product detail (when loaded). */
  servings?: FoodServing[];
  base_unit: string;
  is_verified: boolean;
}

/**
 * One food inside a saved meal. Nutrients/serving are snapshotted so meals
 * render and log correctly even when the product cache has been cleared.
 */
export interface MealItem {
  product_id: string;
  name: string;
  producer: string;
  amount: number;
  base_unit: string;
  nutrients: FoodNutrients;
  serving: FoodServing;
}

/** A user-created meal: foods you often eat together. */
export interface Meal {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  items: MealItem[];
}
