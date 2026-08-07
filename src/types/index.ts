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
