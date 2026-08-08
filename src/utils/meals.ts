import type { MealType } from "@/types"

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"]

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
}

export const MEAL_PLACEHOLDERS: Record<MealType, string> = {
  breakfast: "What did you have for breakfast?",
  lunch: "What did you have for lunch?",
  dinner: "What did you have for dinner?",
  snack: "What did you have for a snack?",
}

export const MEAL_ICONS: Record<
  MealType,
  keyof typeof import("@expo/vector-icons").Ionicons.glyphMap
> = {
  breakfast: "sunny-outline",
  lunch: "restaurant-outline",
  dinner: "moon-outline",
  snack: "cafe-outline",
}
