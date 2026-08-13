import { memo } from "react"
import { ActivityIndicator, Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { SearchFoodResult } from "@/types"
import { formatListNutrientLine } from "@/utils/food-display"
import { isPerGramNutrients } from "@/utils/nutrients"
import { useTheme } from "@/hooks/useTheme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

type Props = {
  food: SearchFoodResult
  onPress: () => void
  onToggleFavorite?: () => void
  isFavorite?: boolean
  subtitle?: string
  /** Instant-add without the dialog. Adds a "+" button on the row. */
  onQuickAdd?: () => void
  /** True while this row's quick-add is in flight (shows a spinner). */
  quickAdding?: boolean
  /** Accent for the icon and quick-add; defaults to the theme primary. */
  accentColor?: string
  /** Show the kcal amount inline on the right (log-meal row style). */
  showKcal?: boolean
  /**
   * `icon` (default): outline add-circle button. `pill`: filled round button
   * with the accent color — the log-meal quick-log affordance.
   */
  quickAddVariant?: "icon" | "pill"
}

export const FoodListItem = memo(function FoodListItem({
  food,
  onPress,
  onToggleFavorite,
  isFavorite,
  subtitle,
  onQuickAdd,
  quickAdding,
  accentColor,
  showKcal,
  quickAddVariant = "icon",
}: Props) {
  const { colors } = useTheme()
  const accent = accentColor ?? colors.primary
  const perGram = isPerGramNutrients(
    food.nutrients,
    food.base_unit || "g",
    food.serving.serving_quantity,
  )
  const kcal = perGram ? Math.round(food.nutrients.kcal * 100) : Math.round(food.nutrients.kcal)

  return (
    <Box className="mx-4 mb-2 flex-row items-center rounded-2xl border border-outline-100 bg-background-50 px-3.5 py-3">
      <Pressable
        className="min-w-0 flex-1 flex-row items-center active:opacity-80"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${food.name}, ${kcal} calories`}
      >
        <Box className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-background-100">
          <Ionicons name="nutrition-outline" size={19} color={accent} />
        </Box>
        <Box className="min-w-0 flex-1">
          <Text size="md" bold className="text-typography-900">
            {food.name}
          </Text>
          <Text size="xs" className="mt-0.5 text-typography-500">
            {subtitle ?? formatListNutrientLine(food)}
          </Text>
        </Box>
        {showKcal ? (
          <Text size="sm" className="ml-2 shrink-0 text-typography-500">
            {kcal} Cal
          </Text>
        ) : null}
      </Pressable>
      {onQuickAdd ? (
        quickAddVariant === "pill" ? (
          <Pressable
            onPress={onQuickAdd}
            disabled={quickAdding}
            hitSlop={8}
            className="ml-2 h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: accent }}
            accessibilityRole="button"
            accessibilityLabel={`Add ${food.name} to diary`}
          >
            {quickAdding ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Ionicons name="add" size={22} color={colors.onPrimary} />
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={onQuickAdd}
            disabled={quickAdding}
            hitSlop={12}
            className="p-1 pl-2"
            accessibilityRole="button"
            accessibilityLabel={`Add ${food.name} to diary`}
          >
            {quickAdding ? (
              <ActivityIndicator size="small" color={accent} />
            ) : (
              <Ionicons name="add-circle" size={24} color={accent} />
            )}
          </Pressable>
        )
      ) : null}
      {onToggleFavorite ? (
        <Pressable
          onPress={onToggleFavorite}
          hitSlop={12}
          className="p-1 pl-2"
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
          accessibilityState={{ selected: Boolean(isFavorite) }}
        >
          <Ionicons
            name={isFavorite ? "star" : "star-outline"}
            size={22}
            color={isFavorite ? colors.warning : colors.textMuted}
          />
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </Box>
  )
})
