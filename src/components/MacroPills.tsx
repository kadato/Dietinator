import { memo } from "react"
import { View, Text, StyleSheet } from "react-native"
import { Feather } from "@expo/vector-icons"
import { useTheme } from "@/hooks/useTheme"
import { formatNumber } from "@/utils/format"
import { fonts } from "@/theme"

type Props = {
  protein: number
  carbs: number
  fat: number
  variant?: "compact" | "detailed" | "card"
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
        <View
          style={[
            styles.cardItem,
            {
              backgroundColor: `${colors.breakfast}14`,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.cardIconBox,
                { backgroundColor: `${colors.breakfast}14`, borderColor: colors.border },
              ]}
            >
              <Feather name="zap" size={12} color={colors.breakfast} />
            </View>
            <Text style={[styles.cardLabel, { color: colors.breakfast }]}>Protein</Text>
          </View>
          <View style={styles.cardValueRow}>
            <Text style={[styles.cardGrams, { color: colors.text }]}>{formatNumber(p)}g</Text>
            <Text style={[styles.cardPct, { color: colors.textMuted }]}>({pPct}%)</Text>
          </View>
        </View>

        <View
          style={[
            styles.cardItem,
            {
              backgroundColor: `${colors.lunch}14`,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.cardIconBox,
                { backgroundColor: `${colors.lunch}14`, borderColor: colors.border },
              ]}
            >
              <Feather name="box" size={12} color={colors.lunch} />
            </View>
            <Text style={[styles.cardLabel, { color: colors.lunch }]}>Carbs</Text>
          </View>
          <View style={styles.cardValueRow}>
            <Text style={[styles.cardGrams, { color: colors.text }]}>{formatNumber(c)}g</Text>
            <Text style={[styles.cardPct, { color: colors.textMuted }]}>({cPct}%)</Text>
          </View>
        </View>

        <View
          style={[
            styles.cardItem,
            {
              backgroundColor: `${colors.dinner}14`,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.cardIconBox,
                { backgroundColor: `${colors.dinner}14`, borderColor: colors.border },
              ]}
            >
              <Feather name="droplet" size={12} color={colors.dinner} />
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
  const iconSize = isXs ? 12 : size === "md" ? 14 : 13

  return (
    <View style={styles.pillContainer}>
      <View
        style={[
          styles.pill,
          isXs ? styles.pillXs : size === "md" ? styles.pillMd : styles.pillSm,
          { backgroundColor: `${colors.breakfast}14`, borderColor: colors.border },
        ]}
      >
        <Feather name="zap" size={iconSize} color={colors.breakfast} style={styles.pillIcon} />
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

      <View
        style={[
          styles.pill,
          isXs ? styles.pillXs : size === "md" ? styles.pillMd : styles.pillSm,
          { backgroundColor: `${colors.lunch}14`, borderColor: colors.border },
        ]}
      >
        <Feather name="box" size={iconSize} color={colors.lunch} style={styles.pillIcon} />
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

      <View
        style={[
          styles.pill,
          isXs ? styles.pillXs : size === "md" ? styles.pillMd : styles.pillSm,
          { backgroundColor: `${colors.dinner}14`, borderColor: colors.border },
        ]}
      >
        <Feather name="droplet" size={iconSize} color={colors.dinner} style={styles.pillIcon} />
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
    borderWidth: 1.5,
    flexShrink: 0,
    borderRadius: 0,
    boxShadow: "none",
    elevation: 0,
  },
  pillXs: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 0,
  },
  pillSm: {
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 0,
  },
  pillMd: {
    paddingHorizontal: 11,
    paddingVertical: 5.5,
    borderRadius: 0,
  },
  pillIcon: {
    marginRight: 3.5,
  },
  pillText: {
    fontWeight: "700",
    fontFamily: fonts.mono,
    fontVariant: ["tabular-nums"],
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  pillTextXs: {
    fontSize: 11,
    lineHeight: 14,
  },
  pillTextSm: {
    fontSize: 12,
    lineHeight: 15,
  },
  pillTextMd: {
    fontSize: 13,
    lineHeight: 17,
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
    borderRadius: 0,
    borderWidth: 1.5,
    boxShadow: "none",
    elevation: 0,
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
    borderRadius: 0,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "none",
    elevation: 0,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: fonts.mono,
    fontVariant: ["tabular-nums"],
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  cardValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    flexWrap: "wrap",
  },
  cardGrams: {
    fontSize: 14,
    fontWeight: "800",
    fontFamily: fonts.mono,
    fontVariant: ["tabular-nums"],
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  cardPct: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: fonts.mono,
    fontVariant: ["tabular-nums"],
    textTransform: "uppercase",
    letterSpacing: 0.4,
    opacity: 0.75,
  },
})
