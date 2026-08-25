import { memo } from "react"
import { View, Text, StyleSheet } from "react-native"
import { Feather } from "@expo/vector-icons"
import { useTheme } from "@/hooks/useTheme"
import { fonts, borders, radii } from "@/theme"
import { chipTint } from "@/theme.helpers"
import { formatNumber } from "@/utils/format"

type Props = {
  protein: number
  carbs: number
  fat: number
  variant?: "compact" | "detailed" | "card"
  size?: "xs" | "sm" | "md"
}

function formatMacro(value: number): string {
  return formatNumber(value, 1)
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

  const maxPct = Math.max(pPct, cPct, fPct)
  const isDominant = (pct: number) => pct === maxPct && maxPct > 35

  if (variant === "card") {
    const cards = [
      { label: "Protein", icon: "zap" as const, accent: colors.breakfast, value: p, pct: pPct },
      { label: "Carbs", icon: "box" as const, accent: colors.lunch, value: c, pct: cPct },
      { label: "Fat", icon: "droplet" as const, accent: colors.dinner, value: f, pct: fPct },
    ]

    return (
      <View style={styles.cardContainer}>
        {cards.map((card) => {
          const dominant = isDominant(card.pct)
          return (
            <View
              key={card.label}
              style={[
                styles.cardItem,
                dominant ? styles.cardItemDominant : styles.cardItemNormal,
                {
                  backgroundColor: chipTint(card.accent, dominant ? 0.16 : 0.1),
                  borderColor: dominant ? card.accent : chipTint(card.accent, 0.4),
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.cardIconBox,
                    dominant && styles.cardIconBoxDominant,
                    {
                      backgroundColor: chipTint(card.accent, dominant ? 0.24 : 0.16),
                      borderColor: chipTint(card.accent, dominant ? 0.6 : 0.35),
                    },
                  ]}
                >
                  <Feather name={card.icon} size={dominant ? 14 : 12} color={card.accent} />
                </View>
                <Text style={[styles.cardLabel, { color: card.accent }]}>{card.label}</Text>
              </View>
              {dominant ? (
                <View style={styles.cardValueCol}>
                  <Text style={[styles.cardGramsDominant, { color: card.accent }]}>
                    {formatMacro(card.value)}g
                  </Text>
                  <Text style={[styles.cardPctDominant, { color: card.accent }]}>
                    ({card.pct}%)
                  </Text>
                </View>
              ) : (
                <View style={styles.cardValueRow}>
                  <Text style={[styles.cardGrams, { color: card.accent }]}>
                    {formatMacro(card.value)}g
                  </Text>
                  <Text style={[styles.cardPct, { color: card.accent }]}>({card.pct}%)</Text>
                </View>
              )}
            </View>
          )
        })}
      </View>
    )
  }

  const isXs = size === "xs"
  const isDetailed = variant === "detailed"
  const iconSize = isXs ? 11 : size === "md" ? 14 : 13

  const pills = [
    { accent: colors.breakfast, icon: "zap" as const, label: "P", value: p, pct: pPct },
    { accent: colors.lunch, icon: "box" as const, label: "C", value: c, pct: cPct },
    { accent: colors.dinner, icon: "droplet" as const, label: "F", value: f, pct: fPct },
  ]

  return (
    <View style={styles.pillContainer}>
      {pills.map((pill) => {
        const dominant = isDominant(pill.pct)
        return (
          <View
            key={pill.icon}
            style={[
              styles.pill,
              isXs ? styles.pillXs : size === "md" ? styles.pillMd : styles.pillSm,
              {
                backgroundColor: chipTint(pill.accent, dominant && isDetailed ? 0.2 : 0.14),
                borderColor: dominant && isDetailed ? pill.accent : chipTint(pill.accent, 0.4),
              },
            ]}
          >
            <Feather name={pill.icon} size={iconSize} color={pill.accent} style={styles.pillIcon} />
            <Text
              style={[
                styles.pillText,
                isXs ? styles.pillTextXs : size === "md" ? styles.pillTextMd : styles.pillTextSm,
                { color: pill.accent },
              ]}
            >
              {formatMacro(pill.value)}g{isDetailed ? ` (${pill.pct}%)` : ""}
            </Text>
          </View>
        )
      })}
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
    justifyContent: "space-between",
    gap: 6,
    width: "100%",
    paddingVertical: 6,
  },
  cardItem: {
    borderRadius: radii.none,
    boxShadow: "none",
    elevation: 0,
    justifyContent: "space-between",
  },
  cardItemNormal: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 8,
    minHeight: 56,
  },
  cardItemDominant: {
    flex: 1.45,
    borderWidth: 1.5,
    paddingHorizontal: 9,
    paddingVertical: 12,
    minHeight: 74,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  cardIconBox: {
    width: 18,
    height: 18,
    borderRadius: radii.none,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "none",
    elevation: 0,
  },
  cardIconBoxDominant: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: fonts.mono,
    fontVariant: ["tabular-nums"],
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  cardValueCol: {
    flexDirection: "column",
    gap: 1,
  },
  cardValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    flexWrap: "wrap",
  },
  cardGrams: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: fonts.mono,
    fontVariant: ["tabular-nums"],
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  cardPct: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: fonts.mono,
    fontVariant: ["tabular-nums"],
    textTransform: "uppercase",
    letterSpacing: 0.2,
    opacity: 0.9,
  },
  cardGramsDominant: {
    fontSize: 17,
    fontWeight: "800",
    fontFamily: fonts.mono,
    fontVariant: ["tabular-nums"],
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cardPctDominant: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: fonts.mono,
    fontVariant: ["tabular-nums"],
    textTransform: "uppercase",
    letterSpacing: 0.3,
    opacity: 0.9,
  },
})
