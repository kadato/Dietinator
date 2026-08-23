import { memo } from "react"
import { View, Text, StyleSheet } from "react-native"
import { Feather } from "@expo/vector-icons"
import { useTheme } from "@/hooks/useTheme"
import { formatNumber } from "@/utils/format"
import { fonts, borders, radii } from "@/theme"
import { chipTint } from "@/theme.helpers"

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
    const cards = [
      { label: "Protein", icon: "zap" as const, accent: colors.breakfast, value: p, pct: pPct },
      { label: "Carbs", icon: "box" as const, accent: colors.lunch, value: c, pct: cPct },
      { label: "Fat", icon: "droplet" as const, accent: colors.dinner, value: f, pct: fPct },
    ]
    return (
      <View style={styles.cardContainer}>
        {cards.map((card) => (
          <View
            key={card.label}
            style={[
              styles.cardItem,
              {
                backgroundColor: chipTint(card.accent, 0.12),
                borderColor: chipTint(card.accent, 0.33),
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.cardIconBox,
                  {
                    backgroundColor: chipTint(card.accent, 0.15),
                    borderColor: chipTint(card.accent, 0.33),
                  },
                ]}
              >
                <Feather name={card.icon} size={13} color={card.accent} />
              </View>
              <Text style={[styles.cardLabel, { color: colors.text }]}>{card.label}</Text>
            </View>
            <View style={styles.cardValueRow}>
              <Text style={[styles.cardGrams, { color: colors.text }]}>
                {formatNumber(card.value)}g
              </Text>
              <Text style={[styles.cardPct, { color: colors.textMuted }]}>({card.pct}%)</Text>
            </View>
          </View>
        ))}
      </View>
    )
  }

  const isXs = size === "xs"
  const isDetailed = variant === "detailed"
  const iconSize = isXs ? 11 : size === "md" ? 14 : 13

  const pills = [
    { accent: colors.breakfast, icon: "zap" as const, value: p },
    { accent: colors.lunch, icon: "box" as const, value: c },
    { accent: colors.dinner, icon: "droplet" as const, value: f },
  ]

  return (
    <View style={styles.pillContainer}>
      {pills.map((pill) => (
        <View
          key={pill.icon}
          style={[
            styles.pill,
            isXs ? styles.pillXs : size === "md" ? styles.pillMd : styles.pillSm,
            { backgroundColor: chipTint(pill.accent), borderColor: chipTint(pill.accent, 0.35) },
          ]}
        >
          <Feather name={pill.icon} size={iconSize} color={pill.accent} style={styles.pillIcon} />
          <Text
            style={[
              styles.pillText,
              isXs ? styles.pillTextXs : size === "md" ? styles.pillTextMd : styles.pillTextSm,
              { color: colors.text },
            ]}
          >
            {" "}
            {formatNumber(pill.value)}g
            {isDetailed
              ? ` (${pill.icon === "zap" ? pPct : pill.icon === "box" ? cPct : fPct}%)`
              : ""}{" "}
          </Text>
        </View>
      ))}
    </View>
  )
})

const styles = StyleSheet.create({
  pillContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    rowGap: 4,
    flexWrap: "wrap",
    maxWidth: "100%",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: borders.width,
    flexShrink: 0,
    borderRadius: radii.none,
    boxShadow: "none",
    elevation: 0,
  },
  pillXs: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.none,
  },
  pillSm: {
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: radii.none,
  },
  pillMd: {
    paddingHorizontal: 11,
    paddingVertical: 5.5,
    borderRadius: radii.none,
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
    flexWrap: "wrap",
  },
  cardItem: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 88,
    minWidth: 88,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radii.none,
    borderWidth: borders.width,
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
    borderRadius: radii.none,
    borderWidth: borders.width,
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
    fontSize: 16,
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
    opacity: 0.8,
  },
})
