import { memo } from "react"
import { ActivityIndicator, Pressable, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import type { FoodNutrients, Meal } from "@/types"
import { useTheme } from "@/hooks/useTheme"
import { MacroPills } from "@/components/MacroPills"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

type Props = {
  meal: Meal
  totals?: FoodNutrients
  onPress: () => void
  onLog?: () => void
  onEdit?: () => void
  onDelete?: () => void
  logging?: boolean
  accentColor?: string
}

export const MealListItem = memo(function MealListItem({
  meal,
  totals,
  onPress,
  onLog,
  onEdit,
  onDelete,
  logging = false,
  accentColor,
}: Props) {
  const { colors } = useTheme()
  const accent = accentColor ?? colors.primary

  const kcal = Math.round(totals?.kcal ?? 0)
  const protein = totals?.protein ?? 0
  const carbs = totals?.carbs ?? 0
  const fat = totals?.fat ?? 0
  const foodCount = meal.items.length === 1 ? "1 food" : `${meal.items.length} foods`

  return (
    <Box className="mb-2.5 flex-row items-center gap-2 rounded-2xl border border-outline-100 bg-background-50 px-4 py-3.5">
      <Pressable
        className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-80"
        onPress={onPress}
        disabled={logging}
        // No aria-label: the accessible name is the visible row text, which always
        // satisfies 2.5.3 label-in-name.
        accessibilityRole="button"
      >
        <Box
          className="h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accent}1f` }}
        >
          {logging ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <Feather name="shopping-bag" size={21} color={accent} />
          )}
        </Box>
        <Box className="min-w-0 flex-1">
          <Text
            size="md"
            bold
            className="text-[15.5px] leading-5 text-typography-900"
            style={{ flexWrap: "wrap" }}
          >
            {meal.name}{" "}
          </Text>
          <View className="mt-1 min-w-0 flex-row flex-wrap items-center gap-1.5">
            <Text size="xs" className="font-tabular text-[12.5px] text-typography-500">
              {foodCount}, {kcal} kcal
            </Text>
            {totals ? <MacroPills protein={protein} carbs={carbs} fat={fat} size="xs" /> : null}
          </View>
        </Box>
      </Pressable>

      {onLog ? (
        <Pressable
          onPress={onLog}
          disabled={logging}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: accent }}
          accessibilityRole="button"
          accessibilityLabel={`Log ${meal.name}`}
        >
          {logging ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Feather name="plus" size={20} color={colors.onPrimary} />
          )}
        </Pressable>
      ) : null}

      {onEdit ? (
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-xl bg-background-100 active:bg-background-200"
          accessibilityRole="button"
          accessibilityLabel={`Edit ${meal.name}`}
        >
          <Feather name="edit-2" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}

      {onDelete ? (
        <Pressable
          onPress={onDelete}
          hitSlop={6}
          className="h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: `${colors.danger}14` }}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${meal.name}`}
        >
          <Feather name="trash-2" size={15} color={colors.danger} />
        </Pressable>
      ) : null}
    </Box>
  )
})
