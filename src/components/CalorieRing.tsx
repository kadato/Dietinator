import { View, Text, StyleSheet } from "react-native"
import { ProgressRing } from "@/components/ProgressRing"
import { useTheme } from "@/hooks/useTheme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { spacing, type ColorPalette } from "@/theme"

type Props = {
  consumed: number
  goal: number
  /** Ring diameter; defaults to 132 (mobile scale). */
  size?: number
}

/**
 * Daily calorie summary: a ring showing how much of the goal is left.
 * Over-goal days flip the ring and the center value to the danger color.
 */
export function CalorieRing({ consumed, goal, size = 132 }: Props) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const remaining = Math.max(goal - consumed, 0)
  const over = consumed > goal ? consumed - goal : 0
  const progress = goal > 0 ? Math.min(consumed / goal, 1) : 0
  const ringColor = over > 0 ? colors.danger : colors.primary
  const scale = size / 132

  return (
    <View style={styles.container}>
      <View style={styles.ringWrap}>
        <ProgressRing
          progress={progress}
          size={size}
          stroke={Math.round(9 * scale)}
          color={ringColor}
          trackColor={colors.surfaceAlt}
        >
          <View style={[styles.ringCenter, { width: size * 0.66 }]}>
            <Text
              maxFontSizeMultiplier={1.2}
              style={[
                styles.remainingValue,
                over > 0 && { color: colors.danger },
                { fontSize: 30 * scale },
              ]}
            >
              {over > 0
                ? Math.round(over).toLocaleString()
                : Math.round(remaining).toLocaleString()}
            </Text>
            <Text style={[styles.remainingLabel, { fontSize: 13 * scale }]}>
              {over > 0 ? "over" : "left"}
            </Text>
          </View>
        </ProgressRing>
      </View>
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
    },
    ringCenter: {
      alignItems: "center",
      justifyContent: "center",
    },
    remainingValue: {
      fontSize: 30,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: -0.5,
      fontVariant: ["tabular-nums"],
    },
    remainingLabel: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
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
