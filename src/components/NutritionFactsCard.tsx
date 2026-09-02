import { useState } from "react"
import { View, Text, StyleSheet, Pressable } from "react-native"
import { Feather } from "@expo/vector-icons"
import type { FoodNutrients } from "@/types"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useTheme } from "@/hooks/useTheme"
import { computeMacroRatios, DAILY_RECOMMENDED_INTAKE } from "@/utils/nutrients"
import { MacroPills } from "@/components/MacroPills"
import { spacing, fonts, type ColorPalette, borders, radii } from "@/theme"
import { cardStyle } from "@/theme/helpers"
import { overlays } from "@/theme/tokens"
import { withAlpha } from "@/utils/color"

type Props = {
  nutrients: FoodNutrients
  servingLabel: string
  baseAmount?: number
  baseUnit?: string
}

function formatMacro(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function NutritionFactsCard({ nutrients, servingLabel, baseAmount, baseUnit = "g" }: Props) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const [expanded, setExpanded] = useState(false)

  const {
    proteinPct: pPct,
    carbsPct: cPct,
    fatPct: fPct,
  } = computeMacroRatios(nutrients.protein, nutrients.carbs, nutrients.fat)

  const per100Scale = baseAmount && baseAmount > 0 ? 100 / baseAmount : 1
  const unitLabel = baseUnit === "ml" ? "100ml" : "100g"

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
      <View style={styles.topRow}>
        <View style={styles.calorieBlock}>
          <Text style={styles.calorieValue} testID="preview-kcal" maxFontSizeMultiplier={2}>
            {nutrients.kcal}
          </Text>
          <Text style={styles.calorieUnit}>kcal</Text>
        </View>
        <Text style={styles.servingNote} numberOfLines={1}>
          {servingLabel}
        </Text>
      </View>

      <View style={styles.bar}>
        {pPct > 0 ? (
          <View style={[styles.barSegment, { flex: pPct, backgroundColor: colors.breakfast }]} />
        ) : null}
        {cPct > 0 ? (
          <View style={[styles.barSegment, { flex: cPct, backgroundColor: colors.lunch }]} />
        ) : null}
        {fPct > 0 ? (
          <View style={[styles.barSegment, { flex: fPct, backgroundColor: colors.dinner }]} />
        ) : null}
      </View>

      <MacroPills
        protein={nutrients.protein}
        carbs={nutrients.carbs}
        fat={nutrients.fat}
        variant="card"
      />

      {micros.length > 0 ? (
        <View style={styles.microSection}>
          <Pressable
            style={[styles.expandToggle]}
            onPress={() => setExpanded(!expanded)}
            accessibilityRole="button"
            accessibilityLabel={
              expanded ? "Hide micronutrients" : `Show micronutrients per ${unitLabel}`
            }
          >
            <Text style={styles.expandToggleText}>
              {expanded
                ? "Hide Micronutrients"
                : `Micronutrients per ${unitLabel} (${micros.length})`}
            </Text>
            <Feather
              name={expanded ? "chevron-up" : "chevron-down"}
              size={14}
              color={colors.primary}
            />
          </Pressable>

          {expanded ? (
            <View style={styles.microGrid}>
              {micros.map((item) => {
                const valPer100 = (item.value ?? 0) * per100Scale
                const rdiPct = Math.round((valPer100 / item.rdi) * 100)
                return (
                  <View key={item.label} style={styles.microRow}>
                    <Text style={styles.microLabel}>{item.label}</Text>
                    <View style={styles.microValWrap}>
                      <Text style={styles.microVal}>
                        {formatMacro(valPer100)} {item.unit}
                        <Text style={styles.microBasis}> / {unitLabel}</Text>
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
    </View>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      ...cardStyle(colors),
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      marginBottom: spacing.sm,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    calorieBlock: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 4,
    },
    calorieValue: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.primary,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    calorieUnit: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    servingNote: {
      fontSize: 11,
      color: colors.textMuted,
      maxWidth: "50%",
      textAlign: "right",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    bar: {
      height: 8,
      flexDirection: "row",
      overflow: "hidden",
      borderRadius: radii.none,
      backgroundColor: colors.surfaceAlt,
      marginBottom: 10,
      borderWidth: borders.width,
      borderColor: colors.border,
      boxShadow: "none",
      elevation: 0,
    },
    barSegment: {
      height: "100%",
      borderTopWidth: borders.width,
      borderTopColor: overlays.highlight,
    },
    macroGrid: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    macroCol: {
      flex: 1,
      alignItems: "flex-start",
    },
    macroLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 2,
    },
    macroDot: {
      width: 6,
      height: 6,
      borderRadius: radii.none,
      backgroundColor: colors.border,
    },
    macroLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    macroVal: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    macroPct: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.textMuted,
      fontFamily: fonts.mono,
    },
    microSection: {
      marginTop: 8,
      borderTopWidth: borders.width,
      borderTopColor: colors.border,
      paddingTop: 4,
    },
    expandToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 6,
      borderWidth: borders.width,
      borderColor: "transparent",
      borderRadius: radii.none,
      paddingHorizontal: 4,
    },
    expandTogglePressed: {
      opacity: 0.7,
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
    },
    expandToggleText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    microGrid: {
      paddingTop: 4,
    },
    microRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 5,
      borderBottomWidth: borders.widthThin,
      borderBottomColor: withAlpha(colors.border, 0.18),
    },
    microLabel: {
      fontSize: 12,
      color: colors.text,
      fontWeight: "600",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    microValWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    microVal: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    microBasis: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    microRdi: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      minWidth: 42,
      textAlign: "right",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
  })
