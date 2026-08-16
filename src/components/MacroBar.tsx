import { View, Text, StyleSheet } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useTheme } from "@/hooks/useTheme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { spacing, fonts, type ColorPalette } from "@/theme"

type MacroRowProps = {
  label: string
  icon: keyof typeof MaterialCommunityIcons.glyphMap
  value: number
  goal: number
  color: string
  styles: ReturnType<typeof createStyles>
  colors: ColorPalette
}

function MacroRow({ label, icon, value, goal, color, styles, colors }: MacroRowProps) {
  const remaining = goal > 0 ? goal - value : 0
  const over = goal > 0 && value > goal ? value - goal : 0
  const progress = goal > 0 ? Math.min(value / goal, 1) : 0

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={styles.labelGroup}>
          <View style={[styles.iconBox, { backgroundColor: `${color}1a` }]}>
            <MaterialCommunityIcons name={icon} size={13} color={color} />
          </View>
          <Text style={[styles.label, { color }]}>{label}</Text>
        </View>

        <View style={styles.valueGroup}>
          <Text style={styles.trackedText}>
            {Math.round(value)}
            {goal > 0 ? (
              <Text style={styles.goalText}> / {Math.round(goal)}g</Text>
            ) : (
              <Text style={styles.goalText}>g</Text>
            )}
          </Text>

          {goal > 0 ? (
            <View
              style={[
                styles.budgetBadge,
                { backgroundColor: over > 0 ? `${colors.danger}18` : `${color}18` },
              ]}
            >
              <Text style={[styles.budgetBadgeText, { color: over > 0 ? colors.danger : color }]}>
                {over > 0 ? `+${Math.round(over)}g over` : `${Math.round(remaining)}g left`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.barBg}>
        <View
          style={[
            styles.barFill,
            {
              width: `${goal > 0 ? progress * 100 : 0}%`,
              backgroundColor: over > 0 ? colors.danger : color,
            },
          ]}
        />
      </View>
    </View>
  )
}

type Props = {
  protein: number
  carbs: number
  fat: number
  proteinGoal: number
  carbsGoal: number
  fatGoal: number
}

/** Daily macro progress: clean, high-legibility macro rows with tracked amount, goal, and remaining budget pill. */
export function MacroBar({ protein, carbs, fat, proteinGoal, carbsGoal, fatGoal }: Props) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.container}>
      <MacroRow
        label="Protein"
        icon="food-drumstick-outline"
        value={protein}
        goal={proteinGoal}
        color={colors.breakfast}
        styles={styles}
        colors={colors}
      />
      <MacroRow
        label="Carbs"
        icon="bread-slice-outline"
        value={carbs}
        goal={carbsGoal}
        color={colors.lunch}
        styles={styles}
        colors={colors}
      />
      <MacroRow
        label="Fat"
        icon="water-outline"
        value={fat}
        goal={fatGoal}
        color={colors.dinner}
        styles={styles}
        colors={colors}
      />
    </View>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: spacing.xs,
    },
    row: {
      gap: 6,
    },
    rowHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    labelGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    iconBox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      fontSize: 13,
      fontWeight: "700",
    },
    valueGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    trackedText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    goalText: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.textMuted,
      fontFamily: fonts.mono,
    },
    budgetBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 8,
    },
    budgetBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    barBg: {
      height: 6,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 999,
      overflow: "hidden",
    },
    barFill: {
      height: "100%",
      borderRadius: 999,
    },
  })
