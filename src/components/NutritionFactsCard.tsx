import { useState } from "react"
import { View, Text, StyleSheet, Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { FoodNutrients } from "@/types"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useTheme } from "@/hooks/useTheme"
import { DAILY_RECOMMENDED_INTAKE } from "@/utils/nutrients"
import { spacing, type ColorPalette } from "@/theme"

type MacroRow = {
  label: string
  value: number
  unit: string
  color: string
  /** kcal per gram — keeps percentage math independent of display labels. */
  factor: number
}

type Props = {
  nutrients: FoodNutrients
  /** e.g. "for 150 g" or "per 100 g" */
  servingLabel: string
}

function formatMacro(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function NutritionFactsCard({ nutrients, servingLabel }: Props) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const [expanded, setExpanded] = useState(false)

  const macroTotal = nutrients.protein * 4 + nutrients.carbs * 4 + nutrients.fat * 9
  const pct = (kcal: number) => (macroTotal > 0 ? Math.round((kcal / macroTotal) * 100) : 0)

  const rows: MacroRow[] = [
    {
      label: "Protein",
      value: nutrients.protein,
      unit: "g",
      color: styles.proteinColor.color,
      factor: 4,
    },
    {
      label: "Carbohydrates",
      value: nutrients.carbs,
      unit: "g",
      color: styles.carbsColor.color,
      factor: 4,
    },
    {
      label: "Fat",
      value: nutrients.fat,
      unit: "g",
      color: styles.fatColor.color,
      factor: 9,
    },
  ]

  const micros = [
    {
      label: "Dietary Fiber",
      value: nutrients.fiber,
      unit: "g",
      rdi: DAILY_RECOMMENDED_INTAKE.fiber.value,
    },
    {
      label: "Total Sugars",
      value: nutrients.sugar,
      unit: "g",
      rdi: DAILY_RECOMMENDED_INTAKE.sugar.value,
    },
    {
      label: "Saturated Fat",
      value: nutrients.saturated_fat,
      unit: "g",
      rdi: DAILY_RECOMMENDED_INTAKE.saturated_fat.value,
    },
    {
      label: "Sodium",
      value: nutrients.sodium,
      unit: "mg",
      rdi: DAILY_RECOMMENDED_INTAKE.sodium.value,
    },
    {
      label: "Potassium",
      value: nutrients.potassium,
      unit: "mg",
      rdi: DAILY_RECOMMENDED_INTAKE.potassium.value,
    },
    {
      label: "Calcium",
      value: nutrients.calcium,
      unit: "mg",
      rdi: DAILY_RECOMMENDED_INTAKE.calcium.value,
    },
    { label: "Iron", value: nutrients.iron, unit: "mg", rdi: DAILY_RECOMMENDED_INTAKE.iron.value },
    {
      label: "Magnesium",
      value: nutrients.magnesium,
      unit: "mg",
      rdi: DAILY_RECOMMENDED_INTAKE.magnesium.value,
    },
    { label: "Zinc", value: nutrients.zinc, unit: "mg", rdi: DAILY_RECOMMENDED_INTAKE.zinc.value },
    {
      label: "Vitamin A",
      value: nutrients.vitamin_a,
      unit: "µg",
      rdi: DAILY_RECOMMENDED_INTAKE.vitamin_a.value,
    },
    {
      label: "Vitamin C",
      value: nutrients.vitamin_c,
      unit: "mg",
      rdi: DAILY_RECOMMENDED_INTAKE.vitamin_c.value,
    },
    {
      label: "Vitamin D",
      value: nutrients.vitamin_d,
      unit: "µg",
      rdi: DAILY_RECOMMENDED_INTAKE.vitamin_d.value,
    },
    {
      label: "Vitamin B12",
      value: nutrients.vitamin_b12,
      unit: "µg",
      rdi: DAILY_RECOMMENDED_INTAKE.vitamin_b12.value,
    },
  ].filter((item) => item.value !== undefined && item.value > 0)

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Nutrition facts</Text>
      <Text style={styles.servingNote}>{servingLabel}</Text>

      <View style={styles.calorieBlock}>
        <Text style={styles.calorieValue} testID="preview-kcal" maxFontSizeMultiplier={1.4}>
          {nutrients.kcal}
        </Text>
        <Text style={styles.calorieUnit}>kcal</Text>
      </View>

      <View style={styles.divider} />

      {rows.map((row) => (
        <View key={row.label} style={styles.macroRow}>
          <View style={styles.macroLabelWrap}>
            <View style={[styles.macroDot, { backgroundColor: row.color }]} />
            <Text style={styles.macroLabel}>{row.label}</Text>
          </View>
          <View style={styles.macroValues}>
            <Text style={styles.macroAmount}>
              {formatMacro(row.value)}
              {row.unit}
            </Text>
            <Text style={styles.macroPct}>{pct(row.value * row.factor)}%</Text>
          </View>
        </View>
      ))}

      {micros.length > 0 ? (
        <View style={styles.microSection}>
          <Pressable
            style={styles.expandToggle}
            onPress={() => setExpanded(!expanded)}
            accessibilityRole="button"
            accessibilityLabel={expanded ? "Hide micronutrients" : "Show detailed micronutrients"}
          >
            <Text style={styles.expandToggleText}>
              {expanded ? "Hide Micronutrients" : `View Micronutrients (${micros.length})`}
            </Text>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.primary}
            />
          </Pressable>

          {expanded ? (
            <View style={styles.microGrid}>
              {micros.map((item) => {
                const rdiPct = Math.round(((item.value ?? 0) / item.rdi) * 100)
                return (
                  <View key={item.label} style={styles.microRow}>
                    <Text style={styles.microLabel}>{item.label}</Text>
                    <View style={styles.microValWrap}>
                      <Text style={styles.microVal}>
                        {formatMacro(item.value ?? 0)} {item.unit}
                      </Text>
                      <Text style={styles.microRdi}>{rdiPct}% RDI</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.footnote}>
        Macro percentages are share of calories from protein, carbs, and fat.
      </Text>
    </View>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
    },
    heading: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    servingNote: {
      fontSize: 14,
      color: colors.text,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    calorieBlock: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: spacing.xs,
    },
    calorieValue: {
      fontSize: 38,
      fontWeight: "800",
      color: colors.primary,
      fontVariant: ["tabular-nums"],
    },
    calorieUnit: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textMuted,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.md,
    },
    macroRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.sm,
    },
    macroLabelWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      flex: 1,
    },
    macroDot: { width: 8, height: 8, borderRadius: 4 },
    macroLabel: { fontSize: 15, color: colors.text, fontWeight: "500" },
    macroValues: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    macroAmount: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      minWidth: 56,
      textAlign: "right",
      fontVariant: ["tabular-nums"],
    },
    macroPct: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
      minWidth: 36,
      textAlign: "right",
      fontVariant: ["tabular-nums"],
    },
    microSection: {
      marginTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.xs,
    },
    expandToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.sm,
    },
    expandToggleText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primary,
    },
    microGrid: {
      paddingTop: spacing.xs,
    },
    microRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: `${colors.border}40`,
    },
    microLabel: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "500",
    },
    microValWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    microVal: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    microRdi: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textMuted,
      minWidth: 48,
      textAlign: "right",
      fontVariant: ["tabular-nums"],
    },
    footnote: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: spacing.md,
      lineHeight: 16,
    },
    proteinColor: { color: colors.breakfast },
    carbsColor: { color: colors.lunch },
    fatColor: { color: colors.dinner },
  })
