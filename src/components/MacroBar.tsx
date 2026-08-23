import { View, Text, StyleSheet } from "react-native"
import { Feather } from "@expo/vector-icons"
import { useTheme } from "@/hooks/useTheme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { spacing, fonts, borders, radii, type ColorPalette } from "@/theme"
import { chipTint } from "@/theme.helpers"

type MacroRowProps = {
  label: string
  icon: keyof typeof Feather.glyphMap
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
          <View
            style={[
              styles.iconBox,
              { borderColor: chipTint(color, 0.35), backgroundColor: chipTint(color) },
            ]}
          >
            <Feather name={icon} size={12} color={color} />
          </View>
          <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
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
                {
                  backgroundColor: over > 0 ? chipTint(colors.danger) : chipTint(color),
                  borderColor: over > 0 ? colors.danger : color,
                },
              ]}
            >
              <Text
                style={[styles.budgetBadgeText, { color: over > 0 ? colors.danger : colors.text }]}
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

export function MacroBar({ protein, carbs, fat, proteinGoal, carbsGoal, fatGoal }: Props) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.container}>
      <MacroRow
        label="Protein"
        icon="zap"
        value={protein}
        goal={proteinGoal}
        color={colors.breakfast}
        styles={styles}
        colors={colors}
      />
      <MacroRow
        label="Carbs"
        icon="box"
        value={carbs}
        goal={carbsGoal}
        color={colors.lunch}
        styles={styles}
        colors={colors}
      />
      <MacroRow
        label="Fat"
        icon="droplet"
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
      borderTopWidth: borders.width,
      borderTopColor: colors.border,
      marginTop: spacing.xs,
      borderRadius: radii.none,
      boxShadow: "none",
      elevation: 0,
    },
    row: {
      gap: 6,
      borderRadius: radii.none,
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
      borderRadius: radii.none,
      borderWidth: borders.width,
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "none",
      elevation: 0,
    },
    label: {
      fontSize: 11,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    valueGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    trackedText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    goalText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    budgetBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radii.none,
      borderWidth: borders.width,
      boxShadow: "none",
      elevation: 0,
    },
    budgetBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    barBg: {
      height: 10,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radii.none,
      overflow: "hidden",
      borderWidth: borders.width,
      borderColor: colors.border,
      boxShadow: "none",
      elevation: 0,
    },
    barFill: {
      height: "100%",
      borderRadius: radii.none,
      // Vibrant fill with a subtle top highlight for luminance separation
      // beyond hue alone (helps deuteranopia/protanopia).
      borderTopWidth: borders.width,
      borderTopColor: "rgba(255,255,255,0.22)",
    },
  })
