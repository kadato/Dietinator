import { View, Text, StyleSheet } from "react-native"
import Svg, { Rect } from "react-native-svg"
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
  size?: number
}

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

  // Square ring rendered with SVG for pixel-perfect corners. The previous
  // four-View strip approach owned one corner per strip, which left a
  // sub-pixel gap or double-paint at the seam when a macro segment ended
  // exactly on a corner. SVG's stroke follows the centerline continuously,
  // so the corners are a single miter join with no seam, and the dash
  // pattern can be offset precisely for the macro split.
  const T = strokeWidth
  const S = size
  const inset = T / 2
  const rectW = Math.max(S - T, 0)
  const rectH = Math.max(S - T, 0)
  const perimeter = 2 * (rectW + rectH)
  const fillTotal = perimeter * progress

  const { macroKcal: macroSumKcal, proteinPct, carbsPct } = computeMacroRatios(protein, carbs, fat)

  // Macro segments along the perimeter. When no macros are logged the whole
  // fill is breakfast blue so the user still sees progress.
  const segments =
    macroSumKcal > 0
      ? [
          { len: fillTotal * (proteinPct / 100), color: colors.breakfast },
          { len: fillTotal * (carbsPct / 100), color: colors.lunch },
          {
            len: fillTotal - fillTotal * (proteinPct / 100) - fillTotal * (carbsPct / 100),
            color: colors.dinner,
          },
        ].filter((s) => s.len > 0.5)
      : fillTotal > 0.5
        ? [{ len: fillTotal, color: colors.breakfast }]
        : []

  let offset = 0
  const svgSegments = segments.map((seg) => {
    const o = offset
    offset += seg.len
    return { ...seg, offset: o }
  })

  return (
    <View style={styles.container}>
      <View style={[styles.ringWrap, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={styles.gaugeSvg}>
          <Rect
            x={inset}
            y={inset}
            width={rectW}
            height={rectH}
            fill="none"
            stroke={colors.surfaceAlt}
            strokeWidth={T}
          />
          {svgSegments.map((seg, index) => (
            <Rect
              key={index}
              x={inset}
              y={inset}
              width={rectW}
              height={rectH}
              fill="none"
              stroke={seg.color}
              strokeWidth={T}
              strokeDasharray={`${seg.len} ${perimeter - seg.len}`}
              strokeDashoffset={-seg.offset}
              strokeLinecap="square"
              strokeLinejoin="miter"
              strokeMiterlimit={4}
            />
          ))}
        </Svg>

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

      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{Math.round(consumed).toLocaleString()}</Text>
          <Text style={styles.statLabel}>EATEN</Text>
        </View>
        <Text style={styles.separator}>·</Text>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{Math.round(goal).toLocaleString()}</Text>
          <Text style={styles.statLabel}>GOAL</Text>
        </View>
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
      borderRadius: 0,
      borderWidth: 0,
      boxShadow: "none",
      elevation: 0,
    },
    ringWrap: {
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    gaugeSvg: {
      position: "absolute",
      top: 0,
      left: 0,
    },
    gaugeTrack: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 0,
      boxShadow: "none",
      elevation: 0,
    },
    gaugeStrip: {
      position: "absolute",
      overflow: "hidden",
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
      letterSpacing: 0.4,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
    },
    remainingLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
      marginTop: spacing.md,
      borderRadius: 0,
    },
    statPill: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 6,
    },
    statValue: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    separator: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textMuted,
      fontFamily: fonts.mono,
    },
    dot: {
      width: 4,
      height: 4,
      borderRadius: 0,
      backgroundColor: colors.border,
      borderWidth: 0,
    },
  })
