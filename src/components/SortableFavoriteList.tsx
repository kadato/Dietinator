/* eslint-disable react-hooks/immutability */
import React, { useCallback } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import type { SearchFoodResult } from "@/types"
import { displayUnit } from "@/utils/food-display"
import { formatNumber } from "@/utils/format"
import { isPerGramNutrients, nutrientsForAmount } from "@/utils/nutrients"
import { getFoodIcon } from "@/utils/food-icon"
import { useTheme } from "@/hooks/useTheme"
import { MacroPills } from "@/components/MacroPills"
import { spacing, fonts, borders, radii } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"

const ITEM_HEIGHT = 80
const SPRING_CONFIG = {
  damping: 18,
  stiffness: 160,
  mass: 0.8,
}

type Props = {
  foods: SearchFoodResult[]
  onReorder: (newFoods: SearchFoodResult[]) => void
  onOpenFood: (food: SearchFoodResult) => void
  onMoveOne: (fromIndex: number, direction: -1 | 1) => void
  accentColor?: string
}

function clamp(value: number, min: number, max: number): number {
  "worklet"
  return Math.min(Math.max(value, min), max)
}

function SortableItem({
  item,
  index,
  totalItems,
  activeId,
  dragY,
  hoverIndex,
  onOpenFood,
  onMoveOne,
  onDragEnd,
  accentColor,
}: {
  item: SearchFoodResult
  index: number
  totalItems: number
  activeId: SharedValue<string | null>
  dragY: SharedValue<number>
  hoverIndex: SharedValue<number>
  onOpenFood: (food: SearchFoodResult) => void
  onMoveOne: (fromIndex: number, direction: -1 | 1) => void
  onDragEnd: (from: number, to: number) => void
  accentColor: string
}) {
  const { colors } = useTheme()
  const isDragging = useSharedValue(false)
  const unit = item.base_unit || "g"
  const perGram = isPerGramNutrients(item.nutrients, unit, item.serving.serving_quantity)
  const effectiveAmount = item.last_amount && item.last_amount > 0 ? item.last_amount : undefined

  const nutrients =
    effectiveAmount !== undefined
      ? nutrientsForAmount(item.nutrients, item.serving, effectiveAmount, unit)
      : {
          kcal: perGram ? Math.round(item.nutrients.kcal * 100) : Math.round(item.nutrients.kcal),
          protein: perGram ? item.nutrients.protein * 100 : item.nutrients.protein,
          carbs: perGram ? item.nutrients.carbs * 100 : item.nutrients.carbs,
          fat: perGram ? item.nutrients.fat * 100 : item.nutrients.fat,
        }

  const portion =
    effectiveAmount !== undefined
      ? `${formatNumber(effectiveAmount)} ${displayUnit(unit)}`
      : perGram
        ? `100 ${displayUnit(unit)}`
        : `${formatNumber(item.serving.amount)} ${displayUnit(unit)}`

  const prefix = item.producer?.trim() ? `${item.producer.trim()}, ` : ""

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(150)
    .onStart(() => {
      activeId.value = item.product_id
      isDragging.value = true
      hoverIndex.value = index
      dragY.value = 0
    })
    .onUpdate((event) => {
      dragY.value = event.translationY
      const newHover = clamp(
        index + Math.round(event.translationY / ITEM_HEIGHT),
        0,
        totalItems - 1,
      )
      hoverIndex.value = newHover
    })
    .onEnd(() => {
      const target = hoverIndex.value
      activeId.value = null
      isDragging.value = false
      dragY.value = 0
      if (target !== index) {
        runOnJS(onDragEnd)(index, target)
      }
    })
    .onFinalize(() => {
      activeId.value = null
      isDragging.value = false
      dragY.value = 0
    })

  const animatedStyle = useAnimatedStyle(() => {
    const isActive = activeId.value === item.product_id

    if (isActive) {
      return {
        transform: [{ translateY: dragY.value }, { scale: withSpring(1.02, SPRING_CONFIG) }],
        zIndex: 999,
        opacity: 0.98,
      }
    }

    return {
      transform: [
        { translateY: withSpring(0, SPRING_CONFIG) },
        { scale: withSpring(1, SPRING_CONFIG) },
      ],
      zIndex: 1,
      opacity: 1,
    }
  })

  return (
    <Animated.View style={[styles.itemContainer, animatedStyle]}>
      <Box
        className="flex-row items-center bg-background-50 px-3 py-3"
        style={{
          borderWidth: borders.width,
          borderColor: colors.border,
          borderRadius: radii.none,
          backgroundColor: colors.surface,
          boxShadow: "none",
          elevation: 0,
        }}
      >
        <GestureDetector gesture={panGesture}>
          <View
            style={styles.dragHandle}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={`Drag handle for ${item.name}`}
          >
            <Feather name="menu" size={18} color={colors.textMuted} />
          </View>
        </GestureDetector>

        <Pressable
          className="min-w-0 flex-1 flex-row items-center pr-1 active:opacity-80"
          onPress={() => onOpenFood(item)}
          accessibilityRole="button"
        >
          <Box
            className="mr-3 h-10 w-10 shrink-0 items-center justify-center bg-background-100"
            style={{
              borderWidth: borders.width,
              borderColor: colors.border,
              borderRadius: radii.none,
              backgroundColor: colors.surfaceAlt,
              boxShadow: "none",
              elevation: 0,
            }}
          >
            <MaterialCommunityIcons
              name={getFoodIcon(item.name, item.nutrients)}
              size={22}
              color={accentColor}
            />
          </Box>
          <Box className="min-w-0 flex-1">
            <Text
              size="md"
              bold
              className="text-[15px] leading-5 text-typography-900"
              numberOfLines={1}
              style={{
                fontFamily: fonts.mono,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              {item.name}{" "}
            </Text>
            <View className="mt-0.5 flex-row flex-wrap items-center gap-1.5">
              <Text
                size="xs"
                className="text-[12px] text-typography-500"
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
          </Box>
        </Pressable>

        <View style={styles.quickButtons}>
          <Pressable
            onPress={() => onMoveOne(index, -1)}
            disabled={index === 0}
            hitSlop={6}
            style={[
              styles.moveBtn,
              { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
              index === 0 && styles.disabledBtn,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Move ${item.name} up`}
          >
            <Feather
              name="chevron-up"
              size={16}
              color={index === 0 ? colors.textMuted : colors.text}
            />
          </Pressable>
          <Pressable
            onPress={() => onMoveOne(index, 1)}
            disabled={index === totalItems - 1}
            hitSlop={6}
            style={[
              styles.moveBtn,
              { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
              index === totalItems - 1 && styles.disabledBtn,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Move ${item.name} down`}
          >
            <Feather
              name="chevron-down"
              size={16}
              color={index === totalItems - 1 ? colors.textMuted : colors.text}
            />
          </Pressable>
        </View>
      </Box>
    </Animated.View>
  )
}

export function SortableFavoriteList({
  foods,
  onReorder,
  onOpenFood,
  onMoveOne,
  accentColor,
}: Props) {
  const { colors } = useTheme()
  const activeId = useSharedValue<string | null>(null)
  const dragY = useSharedValue<number>(0)
  const hoverIndex = useSharedValue<number>(0)

  const handleDragEnd = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= foods.length || to >= foods.length) return
      const next = [...foods]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      onReorder(next)
    },
    [foods, onReorder],
  )

  return (
    <View style={styles.list}>
      {foods.map((food, index) => (
        <SortableItem
          key={food.product_id}
          item={food}
          index={index}
          totalItems={foods.length}
          activeId={activeId}
          dragY={dragY}
          hoverIndex={hoverIndex}
          onOpenFood={onOpenFood}
          onMoveOne={onMoveOne}
          onDragEnd={handleDragEnd}
          accentColor={accentColor ?? colors.primary}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing["2xl"],
  },
  itemContainer: {
    marginBottom: spacing.sm,
  },
  dragHandle: {
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  quickButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: spacing.xs,
  },
  moveBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.none,
    borderWidth: borders.width,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "none",
    elevation: 0,
  },
  moveBtnPressed: {
    opacity: 0.7,
  },
  disabledBtn: {
    opacity: 0.25,
  },
})
