import { View, Text, StyleSheet } from "react-native"
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

  // Square gauge, pure views. Four strips partition the perimeter clockwise
  // from the top-left corner, and each strip owns exactly one corner so the
  // painted path is continuous with no overlap and no gaps:
  //   top (left→right) starts at top-left and owns top-right,
  //   right (top→bottom) owns bottom-right,
  //   bottom (right→left) owns bottom-left,
  //   left (bottom→top) closes the loop back under the starting point.
  // Strip lens sum to the exact centerline perimeter 4S - 4T.
  const T = strokeWidth
  const S = size
  type Strip = {
    key: string
    len: number
    direction: "row" | "column" | "row-reverse" | "column-reverse"
    style: object
  }
  const strips: Strip[] = [
    { key: "top", len: S, direction: "row", style: { top: 0, left: 0, width: S, height: T } },
    {
      key: "right",
      len: S - T,
      direction: "column",
      style: { top: T, left: S - T, width: T, height: S - T },
    },
    {
      key: "bottom",
      len: S - T,
      direction: "row-reverse",
      style: { top: S - T, left: 0, width: S - T, height: T },
    },
    {
      key: "left",
      len: Math.max(S - 2 * T, 0),
      direction: "column-reverse",
      style: { top: T, left: 0, width: T, height: Math.max(S - 2 * T, 0) },
    },
  ]
  const perimeter = strips.reduce((acc, s) => acc + s.len, 0)
  const fillTotal = perimeter * progress

  const { macroKcal: macroSumKcal, proteinPct, carbsPct } = computeMacroRatios(protein, carbs, fat)

  const macroCutProtein = fillTotal * (proteinPct / 100)
  const macroCutCarbs = macroCutProtein + fillTotal * (carbsPct / 100)
  // Fat covers the remainder up to fillTotal.

  let segStart = 0
  const renderedStrips = strips.map((strip) => {
    const fill = Math.max(Math.min(fillTotal - segStart, strip.len), 0)
    const pieces: { len: number; color: string }[] = []
    if (fill > 0) {
      const bounds =
        macroSumKcal > 0
          ? [
              { end: macroCutProtein, color: colors.breakfast },
              { end: macroCutCarbs, color: colors.lunch },
              { end: fillTotal, color: colors.dinner },
            ]
          : [{ end: fillTotal, color: colors.breakfast }]
      let cursor = segStart
      for (const bound of bounds) {
        if (cursor >= segStart + fill) break
        const pieceEnd = Math.min(bound.end, segStart + fill)
        if (pieceEnd > cursor) {
          pieces.push({ len: pieceEnd - cursor, color: bound.color })
          cursor = pieceEnd
        }
      }
    }
    segStart += strip.len
    return { ...strip, fill, pieces }
  })

  return (
    <View style={styles.container}>
      <View style={[styles.ringWrap, { width: size, height: size }]}>
        {/* Track: the full square outline. */}
        <View style={[styles.gaugeTrack, { borderWidth: T, borderColor: colors.surfaceAlt }]} />
        {/* Progress strips, clockwise from the top-left corner. */}
        {renderedStrips.map((strip) =>
          strip.fill > 0 ? (
            <View
              key={strip.key}
              style={[styles.gaugeStrip, strip.style, { flexDirection: strip.direction }]}
            >
              {strip.pieces.map((piece, index) => (
                <View
                  key={`${strip.key}-${index}`}
                  style={{
                    backgroundColor: piece.color,
                    ...(strip.direction === "row" || strip.direction === "row-reverse"
                      ? { width: piece.len }
                      : { height: piece.len }),
                  }}
                />
              ))}
            </View>
          ) : null,
        )}

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
      gap: spacing.sm,
      marginTop: spacing.md,
      borderRadius: 0,
    },
    stat: {
      fontSize: 13,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    statValue: {
      fontWeight: "700",
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    statLabel: {
      color: colors.textMuted,
      fontWeight: "600",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    dot: {
      width: 4,
      height: 4,
      borderRadius: 0,
      backgroundColor: colors.border,
      borderWidth: 0,
    },
  })
