import { memo } from "react"
import { View, Text, StyleSheet } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useTheme } from "@/hooks/useTheme"
import { formatNumber } from "@/utils/format"
import { fonts } from "@/theme"

type Props = {
  protein: number
  carbs: number
  fat: number
  /**
   * - `compact` (default): Minimal inline chips with icon and grams (e.g. `[🍗 25g] [🍞 40g] [💧 12g]`)
   * - `detailed`: Inline chips with grams and percentage of macro calories
   * - `card`: 3-column stats cards with icon badges, labels, grams, and percentage
   */
  variant?: "compact" | "detailed" | "card"
  /** Size scaling for inline pills (`xs` for list subtitles, `sm` for normal cards, `md` for hero views) */
  size?: "xs" | "sm" | "md"
}

export const MacroPills = memo(function MacroPills({
  protein,
  carbs,
  fat,
  variant = "compact",
  size = "sm",
}: Props) {
  const { colors } = useTheme()

  const p = Math.max(protein, 0)
  const c = Math.max(carbs, 0)
  const f = Math.max(fat, 0)

  const pKcal = p * 4
  const cKcal = c * 4
  const fKcal = f * 9
  const totalKcal = pKcal + cKcal + fKcal

  const pPct = totalKcal > 0 ? Math.round((pKcal / totalKcal) * 100) : 0
  const cPct = totalKcal > 0 ? Math.round((cKcal / totalKcal) * 100) : 0
  const fPct = totalKcal > 0 ? Math.round((fKcal / totalKcal) * 100) : 0

  if (variant === "card") {
    return (
      <View style={styles.cardContainer}>
        {/* Protein Card */}
        <View
          style={[
            styles.cardItem,
            { backgroundColor: `${colors.breakfast}15`, borderColor: `${colors.breakfast}40` },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBox, { backgroundColor: `${colors.breakfast}28` }]}>
              <MaterialCommunityIcons
                name="food-drumstick-outline"
                size={13}
                color={colors.breakfast}
              />
            </View>
            <Text style={[styles.cardLabel, { color: colors.breakfast }]}>Protein</Text>
          </View>
          <View style={styles.cardValueRow}>
            <Text style={[styles.cardGrams, { color: colors.text }]}>{formatNumber(p)}g</Text>
            <Text style={[styles.cardPct, { color: colors.textMuted }]}>({pPct}%)</Text>
          </View>
        </View>

        {/* Carbs Card */}
        <View
          style={[
            styles.cardItem,
            { backgroundColor: `${colors.lunch}15`, borderColor: `${colors.lunch}40` },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBox, { backgroundColor: `${colors.lunch}28` }]}>
              <MaterialCommunityIcons name="bread-slice-outline" size={13} color={colors.lunch} />
            </View>
            <Text style={[styles.cardLabel, { color: colors.lunch }]}>Carbs</Text>
          </View>
          <View style={styles.cardValueRow}>
            <Text style={[styles.cardGrams, { color: colors.text }]}>{formatNumber(c)}g</Text>
            <Text style={[styles.cardPct, { color: colors.textMuted }]}>({cPct}%)</Text>
          </View>
        </View>

        {/* Fat Card */}
        <View
          style={[
            styles.cardItem,
            { backgroundColor: `${colors.dinner}15`, borderColor: `${colors.dinner}40` },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBox, { backgroundColor: `${colors.dinner}28` }]}>
              <MaterialCommunityIcons name="water-outline" size={13} color={colors.dinner} />
            </View>
            <Text style={[styles.cardLabel, { color: colors.dinner }]}>Fat</Text>
          </View>
          <View style={styles.cardValueRow}>
            <Text style={[styles.cardGrams, { color: colors.text }]}>{formatNumber(f)}g</Text>
            <Text style={[styles.cardPct, { color: colors.textMuted }]}>({fPct}%)</Text>
          </View>
        </View>
      </View>
    )
  }

  const isXs = size === "xs"
  const isDetailed = variant === "detailed"
  const iconSize = isXs ? 13 : size === "md" ? 16 : 14.5

  return (
    <View style={styles.pillContainer}>
      {/* Protein Pill */}
      <View
        style={[
          styles.pill,
          isXs ? styles.pillXs : size === "md" ? styles.pillMd : styles.pillSm,
          { backgroundColor: `${colors.breakfast}22`, borderColor: `${colors.breakfast}45` },
        ]}
      >
        <MaterialCommunityIcons
          name="food-drumstick-outline"
          size={iconSize}
          color={colors.breakfast}
          style={styles.pillIcon}
        />
        <Text
          style={[
            styles.pillText,
            isXs ? styles.pillTextXs : size === "md" ? styles.pillTextMd : styles.pillTextSm,
            { color: colors.breakfast },
          ]}
        >
          {" "}
          {formatNumber(p)}g{isDetailed ? ` (${pPct}%)` : ""}{" "}
        </Text>
      </View>

      {/* Carbs Pill */}
      <View
        style={[
          styles.pill,
          isXs ? styles.pillXs : size === "md" ? styles.pillMd : styles.pillSm,
          { backgroundColor: `${colors.lunch}22`, borderColor: `${colors.lunch}45` },
        ]}
      >
        <MaterialCommunityIcons
          name="bread-slice-outline"
          size={iconSize}
          color={colors.lunch}
          style={styles.pillIcon}
        />
        <Text
          style={[
            styles.pillText,
            isXs ? styles.pillTextXs : size === "md" ? styles.pillTextMd : styles.pillTextSm,
            { color: colors.lunch },
          ]}
        >
          {" "}
          {formatNumber(c)}g{isDetailed ? ` (${cPct}%)` : ""}{" "}
        </Text>
      </View>

      {/* Fat Pill */}
      <View
        style={[
          styles.pill,
          isXs ? styles.pillXs : size === "md" ? styles.pillMd : styles.pillSm,
          { backgroundColor: `${colors.dinner}22`, borderColor: `${colors.dinner}45` },
        ]}
      >
        <MaterialCommunityIcons
          name="water-outline"
          size={iconSize}
          color={colors.dinner}
          style={styles.pillIcon}
        />
        <Text
          style={[
            styles.pillText,
            isXs ? styles.pillTextXs : size === "md" ? styles.pillTextMd : styles.pillTextSm,
            { color: colors.dinner },
          ]}
        >
          {" "}
          {formatNumber(f)}g{isDetailed ? ` (${fPct}%)` : ""}{" "}
        </Text>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  pillContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
    maxWidth: "100%",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    flexShrink: 0,
  },
  pillXs: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 7,
  },
  pillSm: {
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 10,
  },
  pillMd: {
    paddingHorizontal: 11,
    paddingVertical: 5.5,
    borderRadius: 11,
  },
  pillIcon: {
    marginRight: 3.5,
  },
  pillText: {
    fontWeight: "700",
    fontFamily: fonts.mono,
    fontVariant: ["tabular-nums"],
  },
  pillTextXs: {
    fontSize: 12,
    lineHeight: 15,
  },
  pillTextSm: {
    fontSize: 13,
    lineHeight: 16,
  },
  pillTextMd: {
    fontSize: 14,
    lineHeight: 18,
  },
  cardContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  cardItem: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
  },
  cardIconBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  cardValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    flexWrap: "wrap",
  },
  cardGrams: {
    fontSize: 15,
    fontWeight: "800",
    fontFamily: fonts.mono,
    fontVariant: ["tabular-nums"],
  },
  cardPct: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: fonts.mono,
    opacity: 0.75,
  },
})
