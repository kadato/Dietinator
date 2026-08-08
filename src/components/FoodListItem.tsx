import { memo } from "react"
import { Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { SearchFoodResult } from "@/types"
import { formatListNutrientLine } from "@/utils/food-display"
import { useTheme } from "@/hooks/useTheme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

type Props = {
  food: SearchFoodResult
  onPress: () => void
  onToggleFavorite?: () => void
  isFavorite?: boolean
  subtitle?: string
}

export const FoodListItem = memo(function FoodListItem({
  food,
  onPress,
  onToggleFavorite,
  isFavorite,
  subtitle,
}: Props) {
  const { colors } = useTheme()

  return (
    <Box className="mx-4 mb-2 flex-row items-center rounded-2xl border border-outline-200 bg-background-50 px-4 py-3.5 shadow-soft-1">
      <Pressable
        className="min-w-0 flex-1 flex-row items-center active:opacity-90"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${food.name}, ${Math.round(food.nutrients.kcal)} calories`}
      >
        <Box className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-background-muted">
          <Ionicons name="nutrition-outline" size={20} color={colors.primary} />
        </Box>
        <Box className="min-w-0 flex-1">
          <Text size="md" bold className="text-typography-900" numberOfLines={1}>
            {food.name}
          </Text>
          <Text size="xs" className="mt-0.5 text-typography-500" numberOfLines={1}>
            {subtitle ?? formatListNutrientLine(food)}
          </Text>
        </Box>
      </Pressable>
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
