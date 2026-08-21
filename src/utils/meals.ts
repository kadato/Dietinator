import type { MealType } from "@/types"

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"]

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
}

export const MEAL_ICONS: Record<
  MealType,
  keyof typeof import("@expo/vector-icons").Feather.glyphMap
> = {
  breakfast: "sunrise",
  lunch: "sun",
  dinner: "moon",
  snack: "coffee",
}
