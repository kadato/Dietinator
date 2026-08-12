import { memo } from "react"
import { ActivityIndicator, Pressable, Text, StyleSheet, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { SearchFoodResult } from "@/types"
import { formatListNutrientLine } from "@/utils/food-display"
import { isPerGramNutrients } from "@/utils/nutrients"
import { useTheme } from "@/hooks/useTheme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { spacing, type ColorPalette } from "@/theme"

type Props = {
  food: SearchFoodResult
  subtitle?: string
  accentColor: string
  onPress: () => void
  onAdd: () => void
  /** True while this row's quick-add is in flight (shows a spinner). */
  adding?: boolean
}

export const MealLogFoodRow = memo(function MealLogFoodRow({
  food,
  subtitle,
  accentColor,
  onPress,
  onAdd,
  adding,
}: Props) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const perGram = isPerGramNutrients(
    food.nutrients,
    food.base_unit || "g",
    food.serving.serving_quantity,
  )
  const kcal = perGram ? Math.round(food.nutrients.kcal * 100) : Math.round(food.nutrients.kcal)

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.mainTap}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${food.name}, ${kcal} calories`}
      >
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {food.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {subtitle ?? formatListNutrientLine(food)}
          </Text>
        </View>
        <Text style={styles.kcal}>{kcal} Cal</Text>
      </Pressable>
      <Pressable
        style={[styles.addBtn, { backgroundColor: accentColor }]}
        onPress={onAdd}
        disabled={adding}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Add ${food.name} to diary`}
      >
        {adding ? (
          <ActivityIndicator size="small" color={colors.onPrimary} />
        ) : (
          <Ionicons name="add" size={22} color={colors.onPrimary} />
        )}
      </Pressable>
    </View>
  )
})

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mainTap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minWidth: 0,
    },
    info: { flex: 1, minWidth: 0 },
    name: { fontSize: 16, color: colors.text, fontWeight: "600" },
    meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    kcal: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: "500",
    },
    addBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
  })
