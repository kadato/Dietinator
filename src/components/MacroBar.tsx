import { View, Text, StyleSheet } from "react-native"
import { useTheme } from "@/hooks/useTheme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { spacing, type ColorPalette } from "@/theme"

type MacroRowProps = {
  label: string
  value: number
  goal: number
  color: string
  styles: ReturnType<typeof createStyles>
  colors: ColorPalette
}

function MacroRow({ label, value, goal, color, styles, colors }: MacroRowProps) {
  const remaining = goal > 0 ? goal - value : 0
  const over = goal > 0 && value > goal ? value - goal : 0
  const progress = goal > 0 ? Math.min(value / goal, 1) : 0

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={styles.labelGroup}>
          <View style={[styles.dot, { backgroundColor: color }]} />
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
                { backgroundColor: over > 0 ? `${colors.danger}18` : `${colors.primary}18` },
              ]}
            >
              <Text
                style={[
                  styles.budgetBadgeText,
                  { color: over > 0 ? colors.danger : colors.primary },
                ]}
              >
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
        value={protein}
        goal={proteinGoal}
        color={colors.breakfast}
        styles={styles}
        colors={colors}
      />
      <MacroRow
        label="Carbs"
        value={carbs}
        goal={carbsGoal}
        color={colors.lunch}
        styles={styles}
        colors={colors}
      />
      <MacroRow
        label="Fat"
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
      gap: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: spacing.xs,
    },
    row: {
      gap: 5,
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
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
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
      fontVariant: ["tabular-nums"],
    },
    goalText: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.textMuted,
    },
    budgetBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 8,
    },
    budgetBadgeText: {
      fontSize: 11,
      fontWeight: "700",
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
