import { View, Text, StyleSheet } from "react-native"
import Svg, { Circle, G } from "react-native-svg"
import { useTheme } from "@/hooks/useTheme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { computeMacroRatios } from "@/utils/nutrients"
import { spacing, fonts, type ColorPalette } from "@/theme"

type Props = {
  consumed: number
  goal: number
  protein?: number
  carbs?: number
  fat?: number
  /** Ring diameter; defaults to 132 (mobile scale). */
  size?: number
}

/**
 * Daily calorie summary ring with color-coded macro distribution arcs:
 * - Protein: colors.breakfast (Coral / Orange)
 * - Carbs: colors.lunch (Cyan / Blue)
 * - Fat: colors.dinner (Purple / Violet)
 * Over-goal days highlight the center remaining value with danger color.
 */
export function CalorieRing({
  consumed,
  goal,
  protein = 0,
  carbs = 0,
  fat = 0,
  size = 132,
}: Props) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)

  const remaining = Math.max(goal - consumed, 0)
  const over = goal > 0 && consumed > goal ? consumed - goal : 0
  const progress = goal > 0 ? Math.min(consumed / goal, 1) : 0
  const scale = size / 132
  const strokeWidth = Math.max(Math.round(10 * scale), 8)

  const radius = (size - strokeWidth) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius

  const {
    macroKcal: macroSumKcal,
    proteinPct,
    carbsPct,
    fatPct,
  } = computeMacroRatios(protein, carbs, fat)

  // Calculate arc lengths for each macronutrient
  const totalArcLength = circumference * progress

  let proteinArc = 0
  let carbsArc = 0
  let fatArc = 0

  if (macroSumKcal > 0 && totalArcLength > 0) {
    proteinArc = totalArcLength * (proteinPct / 100)
    carbsArc = totalArcLength * (carbsPct / 100)
    fatArc = totalArcLength * (fatPct / 100)
  } else if (totalArcLength > 0) {
    // Fallback if no macros logged but calories logged
    proteinArc = totalArcLength
  }

  // Slight gap between segments if multiple macros are present
  const hasMultiple = [proteinArc > 2, carbsArc > 2, fatArc > 2].filter(Boolean).length > 1
  const gap = hasMultiple ? 1.5 : 0

  const proteinDash = Math.max(proteinArc - gap, 0)
  const carbsDash = Math.max(carbsArc - gap, 0)
  const fatDash = Math.max(fatArc - gap, 0)

  const proteinOffset = 0
  const carbsOffset = proteinArc
  const fatOffset = proteinArc + carbsArc

  return (
    <View style={styles.container}>
      <View style={[styles.ringWrap, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          {/* Background Track */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.surfaceAlt}
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* Macro Arc Segments (Rotated -90deg so 0 is at 12 o'clock) */}
          <G transform={`rotate(-90 ${center} ${center})`}>
            {/* Protein Segment */}
            {proteinDash > 0 ? (
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke={colors.breakfast}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${proteinDash} ${circumference}`}
                strokeDashoffset={-proteinOffset}
              />
            ) : null}

            {/* Carbs Segment */}
            {carbsDash > 0 ? (
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke={colors.lunch}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${carbsDash} ${circumference}`}
                strokeDashoffset={-carbsOffset}
              />
            ) : null}

            {/* Fat Segment */}
            {fatDash > 0 ? (
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke={colors.dinner}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${fatDash} ${circumference}`}
                strokeDashoffset={-fatOffset}
              />
            ) : null}
          </G>
        </Svg>

        {/* Center Calorie Display */}
        <View style={[styles.ringCenter, { width: size * 0.72, height: size * 0.72 }]}>
          <Text
            maxFontSizeMultiplier={1.2}
            style={[
              styles.remainingValue,
              over > 0 && { color: colors.danger },
              { fontSize: 28 * scale },
            ]}
          >
            {over > 0 ? Math.round(over).toLocaleString() : Math.round(remaining).toLocaleString()}
          </Text>
          <Text style={[styles.remainingLabel, { fontSize: 12 * scale }]}>
            {over > 0 ? "kcal over" : "kcal left"}
          </Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <Text style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(consumed).toLocaleString()}</Text>{" "}
          <Text style={styles.statLabel}>eaten</Text>
        </Text>
        <View style={styles.dot} />
        <Text style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(goal).toLocaleString()}</Text>{" "}
          <Text style={styles.statLabel}>goal</Text>
        </Text>
      </View>
    </View>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      padding: spacing.lg,
      paddingBottom: spacing.sm,
      alignItems: "center",
    },
    ringWrap: {
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    ringCenter: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
    },
    remainingValue: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: -0.5,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    remainingLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
      fontWeight: "600",
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    stat: {
      fontSize: 14,
    },
    statValue: {
      fontWeight: "700",
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    statLabel: {
      color: colors.textMuted,
      fontWeight: "500",
    },
    dot: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
  })
