import { memo, useEffect, useRef, useState } from "react"
import { ActivityIndicator, Pressable, View } from "react-native"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import type { SearchFoodResult } from "@/types"
import { displayUnit } from "@/utils/food-display"
import { formatNumber } from "@/utils/format"
import { isPerGramNutrients, nutrientsForAmount } from "@/utils/nutrients"
import { getFoodIcon } from "@/utils/food-icon"
import { useTheme } from "@/hooks/useTheme"
import { MacroPills } from "@/components/MacroPills"
import { fonts } from "@/theme"
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
   * with the accent color, the log-meal quick-log affordance.
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

  // Receipt flash: when this row's quick-add resolves, the pill shows a
  // check for a beat so the commit is confirmed at the finger, not only in
  // the header arithmetic. Self-contained; no parent wiring needed.
  const [justAdded, setJustAdded] = useState(false)
  const prevAddingRef = useRef(quickAdding ?? false)
  useEffect(() => {
    const wasAdding = prevAddingRef.current
    prevAddingRef.current = quickAdding ?? false
    if (wasAdding && !quickAdding) {
      setJustAdded(true)
      const timer = setTimeout(() => setJustAdded(false), 900)
      return () => clearTimeout(timer)
    }
  }, [quickAdding])

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

  const prefix = food.producer?.trim() ? `${food.producer.trim()}, ` : ""

  return (
    <Box
      className="mx-3 mb-2 flex-row items-center rounded-none bg-background-50 px-3 py-2.5"
      style={{
        borderWidth: 1.5,
        borderColor: colors.border,
        borderLeftWidth: 3,
        borderLeftColor: accent,
        borderRadius: 0,
        backgroundColor: colors.surface,
        boxShadow: "none",
        elevation: 0,
      }}
    >
      <Pressable
        className="min-w-0 flex-1 flex-row items-center active:opacity-80"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${food.name}, ${prefix.trim()} ${portion}, ${Math.round(nutrients.kcal)} kcal, ${formatNumber(nutrients.protein)}g ${formatNumber(nutrients.carbs)}g ${formatNumber(nutrients.fat)}g, ${Math.round(nutrients.kcal)} Cal`}
      >
        <Box
          className="mr-3 h-10 w-10 shrink-0 items-center justify-center rounded-none bg-background-100"
          style={{
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 0,
            backgroundColor: `${accent}14`,
            boxShadow: "none",
            elevation: 0,
          }}
        >
          <MaterialCommunityIcons
            name={getFoodIcon(food.name, food.nutrients)}
            size={24}
            color={accent}
          />
        </Box>
        <Box className="min-w-0 flex-1 gap-1">
          <Text
            size="md"
            bold
            className="text-[15.5px] leading-5 text-typography-900"
            style={{
              fontFamily: fonts.mono,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              flexWrap: "wrap",
            }}
          >
            {food.name}{" "}
          </Text>
          {subtitle ? (
            <Text
              size="xs"
              className="text-[12.5px] leading-4 text-typography-500"
              style={{
                fontFamily: fonts.mono,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                fontVariant: ["tabular-nums"],
              }}
            >
              {subtitle}
            </Text>
          ) : (
            <View className="flex-row flex-wrap items-center gap-1">
              <Text
                size="xs"
                className="text-[12.5px] leading-4 text-typography-500"
                style={{
                  fontFamily: fonts.mono,
                  fontVariant: ["tabular-nums"],
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                }}
              >
                {prefix}
                {portion}, {Math.round(nutrients.kcal)} kcal
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
            className="ml-2 shrink-0 text-sm font-semibold text-typography-500"
            style={{
              fontFamily: fonts.mono,
              fontVariant: ["tabular-nums"],
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
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
            className="h-9 w-9 items-center justify-center rounded-none bg-background-100 active:bg-background-200"
            style={{
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 0,
              backgroundColor: colors.surfaceAlt,
              boxShadow: "none",
              elevation: 0,
              opacity: canMoveUp ? 1 : 0.3,
            }}
            accessibilityRole="button"
            accessibilityLabel={`Move ${food.name} up`}
          >
            <Feather
              name="chevron-up"
              size={18}
              color={canMoveUp ? colors.text : colors.textMuted}
            />
          </Pressable>
          <Pressable
            onPress={onMoveDown}
            disabled={!canMoveDown}
            hitSlop={6}
            className="h-9 w-9 items-center justify-center rounded-none bg-background-100 active:bg-background-200"
            style={{
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 0,
              backgroundColor: colors.surfaceAlt,
              boxShadow: "none",
              elevation: 0,
              opacity: canMoveDown ? 1 : 0.3,
            }}
            accessibilityRole="button"
            accessibilityLabel={`Move ${food.name} down`}
          >
            <Feather
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
            className="ml-2 flex-row items-center justify-center rounded-none px-2.5 py-1.5 active:opacity-85"
            style={{
              backgroundColor: accent,
              borderWidth: 1.5,
              borderColor: accent,
              borderRadius: 0,
              minHeight: 34,
              minWidth: 44,
              boxShadow: "none",
              elevation: 0,
            }}
            accessibilityRole="button"
            accessibilityLabel={`Add ${portion} of ${food.name} to diary`}
          >
            {quickAdding ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : justAdded ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Feather name="check" size={16} color={colors.onPrimary} />
                <Text
                  size="xs"
                  bold
                  className="text-[12px] leading-4"
                  style={{
                    color: colors.onPrimary,
                    fontFamily: fonts.mono,
                    fontVariant: ["tabular-nums"],
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  {portion}
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Feather name="plus" size={16} color={colors.onPrimary} />
                <Text
                  size="xs"
                  bold
                  className="text-[12px] leading-4"
                  style={{
                    color: colors.onPrimary,
                    fontFamily: fonts.mono,
                    fontVariant: ["tabular-nums"],
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
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
            style={{
              borderWidth: 1.5,
              borderColor: "transparent",
              borderRadius: 0,
              backgroundColor: "transparent",
              boxShadow: "none",
              elevation: 0,
            }}
            accessibilityRole="button"
            accessibilityLabel={`Add ${food.name} to diary`}
          >
            {quickAdding ? (
              <ActivityIndicator size="small" color={accent} />
            ) : (
              <Feather name="plus-circle" size={24} color={accent} />
            )}
          </Pressable>
        )
      ) : null}
      {!isReordering && onToggleFavorite ? (
        <Pressable
          onPress={onToggleFavorite}
          hitSlop={12}
          className="p-1 pl-2"
          style={{
            borderWidth: 1.5,
            borderColor: "transparent",
            borderRadius: 0,
            backgroundColor: "transparent",
            boxShadow: "none",
            elevation: 0,
          }}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
          accessibilityState={{ selected: Boolean(isFavorite) }}
        >
          <Feather name="star" size={22} color={isFavorite ? colors.warning : colors.textMuted} />
        </Pressable>
      ) : !isReordering && !onQuickAdd ? (
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      ) : null}
    </Box>
  )
})
