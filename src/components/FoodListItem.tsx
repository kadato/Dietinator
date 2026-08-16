import { memo } from "react"
import { ActivityIndicator, Pressable, View } from "react-native"
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import type { SearchFoodResult } from "@/types"
import { displayUnit } from "@/utils/food-display"
import { formatNumber } from "@/utils/format"
import { isPerGramNutrients, nutrientsForAmount } from "@/utils/nutrients"
import { getFoodIcon } from "@/utils/food-icon"
import { useTheme } from "@/hooks/useTheme"
import { MacroPills } from "@/components/MacroPills"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

type Props = {
  food: SearchFoodResult
  onPress: () => void
  onToggleFavorite?: () => void
  isFavorite?: boolean
  subtitle?: string
  amount?: number
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
  /** Whether reorder mode is active (shows move up/down buttons). */
  isReordering?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
}

export const FoodListItem = memo(function FoodListItem({
  food,
  onPress,
  onToggleFavorite,
  isFavorite,
  subtitle,
  amount,
  onQuickAdd,
  quickAdding,
  accentColor,
  showKcal,
  quickAddVariant = "icon",
  isReordering = false,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: Props) {
  const { colors } = useTheme()
  const accent = accentColor ?? colors.primary
  const unit = food.base_unit || "g"

  const perGram = isPerGramNutrients(food.nutrients, unit, food.serving.serving_quantity)
  const effectiveAmount =
    amount !== undefined
      ? amount
      : food.last_amount && food.last_amount > 0
        ? food.last_amount
        : undefined

  const nutrients =
    effectiveAmount !== undefined
      ? nutrientsForAmount(food.nutrients, food.serving, effectiveAmount, unit)
      : {
          kcal: perGram ? Math.round(food.nutrients.kcal * 100) : Math.round(food.nutrients.kcal),
          protein: perGram ? food.nutrients.protein * 100 : food.nutrients.protein,
          carbs: perGram ? food.nutrients.carbs * 100 : food.nutrients.carbs,
          fat: perGram ? food.nutrients.fat * 100 : food.nutrients.fat,
        }

  const portion =
    effectiveAmount !== undefined
      ? `${formatNumber(effectiveAmount)} ${displayUnit(unit)}`
      : perGram
        ? `100 ${displayUnit(unit)}`
        : `${formatNumber(food.serving.amount)} ${displayUnit(unit)}`

  const prefix = food.producer?.trim() ? `${food.producer.trim()} · ` : ""

  return (
    <Box className="mx-4 mb-2.5 flex-row items-center rounded-2xl border border-outline-100 bg-background-50 px-4 py-3.5">
      <Pressable
        className="min-w-0 flex-1 flex-row items-center active:opacity-80"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${food.name}, ${Math.round(nutrients.kcal)} calories`}
      >
        <Box className="mr-3.5 h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background-100">
          <MaterialCommunityIcons
            name={getFoodIcon(food.name, food.nutrients)}
            size={24}
            color={accent}
          />
        </Box>
        <Box className="min-w-0 flex-1">
          <Text
            size="md"
            bold
            className="text-[15.5px] leading-5 text-typography-900"
            numberOfLines={1}
          >
            {food.name}
          </Text>
          {subtitle ? (
            <Text size="xs" className="mt-0.5 text-[12.5px] text-typography-500" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : (
            <View className="mt-1 flex-row flex-wrap items-center gap-1.5">
              <Text size="xs" className="font-tabular text-[12.5px] text-typography-500">
                {prefix}
                {portion} · {Math.round(nutrients.kcal)} kcal
              </Text>
              <MacroPills
                protein={nutrients.protein}
                carbs={nutrients.carbs}
                fat={nutrients.fat}
                size="xs"
              />
            </View>
          )}
        </Box>
        {showKcal ? (
          <Text
            size="sm"
            className="font-tabular ml-2 shrink-0 text-sm font-semibold text-typography-500"
          >
            {Math.round(nutrients.kcal)} Cal
          </Text>
        ) : null}
      </Pressable>
      {isReordering ? (
        <Box className="ml-2 flex-row items-center gap-1.5">
          <Pressable
            onPress={onMoveUp}
            disabled={!canMoveUp}
            hitSlop={6}
            className={`h-9 w-9 items-center justify-center rounded-xl bg-background-100 ${
              canMoveUp ? "active:bg-background-200" : "opacity-30"
            }`}
            accessibilityRole="button"
            accessibilityLabel={`Move ${food.name} up`}
          >
            <Ionicons
              name="chevron-up"
              size={18}
              color={canMoveUp ? colors.text : colors.textMuted}
            />
          </Pressable>
          <Pressable
            onPress={onMoveDown}
            disabled={!canMoveDown}
            hitSlop={6}
            className={`h-9 w-9 items-center justify-center rounded-xl bg-background-100 ${
              canMoveDown ? "active:bg-background-200" : "opacity-30"
            }`}
            accessibilityRole="button"
            accessibilityLabel={`Move ${food.name} down`}
          >
            <Ionicons
              name="chevron-down"
              size={18}
              color={canMoveDown ? colors.text : colors.textMuted}
            />
          </Pressable>
        </Box>
      ) : onQuickAdd ? (
        quickAddVariant === "pill" ? (
          <Pressable
            onPress={onQuickAdd}
            disabled={quickAdding}
            hitSlop={6}
            className="ml-2 flex-row items-center justify-center rounded-xl px-2.5 py-1.5 active:opacity-85"
            style={{ backgroundColor: accent, minHeight: 34, minWidth: 44 }}
            accessibilityRole="button"
            accessibilityLabel={`Add ${portion} of ${food.name} to diary`}
          >
            {quickAdding ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="add" size={16} color={colors.onPrimary} />
                <Text
                  size="xs"
                  bold
                  className="font-tabular text-[12px] leading-4"
                  style={{ color: colors.onPrimary }}
                >
                  {portion}
                </Text>
              </View>
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
      {!isReordering && onToggleFavorite ? (
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
      ) : !isReordering && !onQuickAdd ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </Box>
  )
})
