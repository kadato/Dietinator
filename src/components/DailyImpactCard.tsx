import { memo, useState } from "react"
import { View, Text, StyleSheet, Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/hooks/useTheme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { DAILY_RECOMMENDED_INTAKE } from "@/utils/nutrients"
import type { AppSettings, FoodNutrients } from "@/types"
import { spacing, fonts, type ColorPalette } from "@/theme"

type Props = {
  currentDayNutrients: FoodNutrients
  itemNutrients: FoodNutrients
  settings: AppSettings
}

type MacroCompareRowProps = {
  label: string
  current: number
  added: number
  goal: number
  color: string
  styles: ReturnType<typeof createStyles>
  colors: ColorPalette
}

const MacroCompareRow = memo(function MacroCompareRow({
  label,
  current,
  added,
  goal,
  color,
  styles,
  colors,
}: MacroCompareRowProps) {
  const projected = current + added
  const remaining = goal > 0 ? goal - projected : 0
  const over = goal > 0 && projected > goal ? projected - goal : 0
  const currentPct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0
  const addedPct = goal > 0 ? Math.min((added / goal) * 100, Math.max(100 - currentPct, 0)) : 0

  return (
    <View style={styles.macroRow}>
      <View style={styles.macroRowHeader}>
        <View style={styles.labelGroup}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.macroLabel, { color }]}>{label}</Text>
        </View>

        <View style={styles.valueGroup}>
          <Text style={styles.transitionText}>
            {Math.round(current)}g <Text style={styles.arrowText}>→</Text>{" "}
            <Text style={styles.projectedText}>{Math.round(projected)}g</Text>{" "}
            <Text style={[styles.addedText, { color }]}>(+{Math.round(added)}g)</Text>
          </Text>

          {goal > 0 ? (
            <View
              style={[
                styles.budgetBadge,
                {
                  backgroundColor: over > 0 ? `${colors.danger}18` : `${colors.primary}18`,
                },
              ]}
            >
              <Text
                style={[
                  styles.budgetBadgeText,
                  { color: over > 0 ? colors.danger : colors.primary },
                ]}
              >
                {over > 0 ? `+${Math.round(over)}g over` : `${Math.round(remaining)}g left`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {goal > 0 ? (
        <View style={styles.barTrack}>
          {/* Current Day Intake */}
          <View
            style={[
              styles.barSegment,
              {
                width: `${currentPct}%`,
                backgroundColor: color,
                opacity: 0.5,
              },
            ]}
          />
          {/* Added Portion Impact */}
          <View
            style={[
              styles.barSegment,
              {
                width: `${addedPct}%`,
                backgroundColor: over > 0 ? colors.danger : color,
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  )
})

const MicroCompareRow = memo(function MicroCompareRow({
  label,
  current,
  added,
  unit,
  rdi,
  styles,
  colors,
}: {
  label: string
  current: number
  added: number
  unit: string
  rdi: number
  styles: ReturnType<typeof createStyles>
  colors: ColorPalette
}) {
  const projected = current + added
  const currentRdiPct = Math.round((current / rdi) * 100)
  const projectedRdiPct = Math.round((projected / rdi) * 100)
  const addedRdiPct = projectedRdiPct - currentRdiPct

  return (
    <View style={styles.microRow}>
      <View style={styles.microHeader}>
        <Text style={styles.microLabel}>{label}</Text>
        <Text style={styles.microValues}>
          {Math.round(current * 10) / 10} →{" "}
          <Text style={styles.microProjected}>
            {Math.round(projected * 10) / 10} {unit}
          </Text>{" "}
          <Text style={styles.microAdded}>
            (+{Math.round(added * 10) / 10} {unit})
          </Text>
        </Text>
      </View>

      <View style={styles.microBarTrack}>
        <View
          style={[
            styles.microBarSegment,
            {
              width: `${Math.min(currentRdiPct, 100)}%`,
              backgroundColor: colors.primary,
              opacity: 0.45,
            },
          ]}
        />
        <View
          style={[
            styles.microBarSegment,
            {
              width: `${Math.min(addedRdiPct, Math.max(100 - currentRdiPct, 0))}%`,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </View>
      <Text style={styles.rdiSub}>
        {projectedRdiPct}% of {rdi} {unit} daily recommendation
      </Text>
    </View>
  )
})

export const DailyImpactCard = memo(function DailyImpactCard({
  currentDayNutrients,
  itemNutrients,
  settings,
}: Props) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const [showMicros, setShowMicros] = useState(false)

  const currentKcal = Math.round(currentDayNutrients.kcal)
  const addedKcal = Math.round(itemNutrients.kcal)
  const projectedKcal = currentKcal + addedKcal
  const goalKcal = Math.round(settings.calorie_goal)
  const remainingKcal = goalKcal > 0 ? Math.max(goalKcal - projectedKcal, 0) : null
  const overKcal = goalKcal > 0 && projectedKcal > goalKcal ? projectedKcal - goalKcal : null

  const currentKcalPct = goalKcal > 0 ? Math.min((currentKcal / goalKcal) * 100, 100) : 0
  const addedKcalPct =
    goalKcal > 0 ? Math.min((addedKcal / goalKcal) * 100, Math.max(100 - currentKcalPct, 0)) : 0

  // Check if any sub-macros or micros are present in the item
  const hasMicros = Boolean(
    itemNutrients.fiber ||
    itemNutrients.sugar ||
    itemNutrients.saturated_fat ||
    itemNutrients.sodium ||
    itemNutrients.potassium ||
    itemNutrients.calcium ||
    itemNutrients.iron ||
    itemNutrients.vitamin_c,
  )

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleWrap}>
          <Ionicons name="analytics-outline" size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Daily Budget Impact</Text>
        </View>
        <Text style={styles.cardSubtitle}>Where you will be after logging</Text>
      </View>

      {/* Calories Hero Impact Row */}
      <View style={styles.calorieHero}>
        <View style={styles.calorieTopRow}>
          <View>
            <Text style={styles.heroLabel}>Total Calories</Text>
            <Text style={styles.heroTransition}>
              {currentKcal.toLocaleString()} →{" "}
              <Text style={styles.heroProjected}>{projectedKcal.toLocaleString()}</Text>{" "}
              <Text style={styles.heroAdded}>(+{addedKcal.toLocaleString()} kcal)</Text>
            </Text>
          </View>

          {goalKcal > 0 ? (
            <View
              style={[
                styles.calorieBadge,
                {
                  backgroundColor: overKcal ? `${colors.danger}18` : `${colors.primary}18`,
                },
              ]}
            >
              <Text
                style={[
                  styles.calorieBadgeText,
                  { color: overKcal ? colors.danger : colors.primary },
                ]}
              >
                {overKcal
                  ? `+${overKcal.toLocaleString()} kcal over`
                  : `${remainingKcal?.toLocaleString()} kcal left`}
              </Text>
            </View>
          ) : null}
        </View>

        {goalKcal > 0 ? (
          <View style={styles.heroBarTrack}>
            <View
              style={[
                styles.heroBarSegment,
                {
                  width: `${currentKcalPct}%`,
                  backgroundColor: colors.primary,
                  opacity: 0.45,
                },
              ]}
            />
            <View
              style={[
                styles.heroBarSegment,
                {
                  width: `${addedKcalPct}%`,
                  backgroundColor: overKcal ? colors.danger : colors.primary,
                },
              ]}
            />
          </View>
        ) : null}
      </View>

      {/* Macros Section */}
      <View style={styles.macrosSection}>
        <MacroCompareRow
          label="Protein"
          current={currentDayNutrients.protein}
          added={itemNutrients.protein}
          goal={settings.protein_goal}
          color={colors.breakfast}
          styles={styles}
          colors={colors}
        />
        <MacroCompareRow
          label="Carbs"
          current={currentDayNutrients.carbs}
          added={itemNutrients.carbs}
          goal={settings.carbs_goal}
          color={colors.lunch}
          styles={styles}
          colors={colors}
        />
        <MacroCompareRow
          label="Fat"
          current={currentDayNutrients.fat}
          added={itemNutrients.fat}
          goal={settings.fat_goal}
          color={colors.dinner}
          styles={styles}
          colors={colors}
        />
      </View>

      {/* Sub-Macros & Micros Impact Accordion */}
      {hasMicros ? (
        <View style={styles.microsAccordion}>
          <Pressable
            onPress={() => setShowMicros((v) => !v)}
            style={styles.accordionBtn}
            accessibilityRole="button"
            accessibilityLabel="Toggle micronutrient impact"
          >
            <View style={styles.accordionLeft}>
              <Ionicons name="leaf-outline" size={15} color={colors.textMuted} />
              <Text style={styles.accordionTitle}>Micronutrient & Sub-Macro Impact</Text>
            </View>
            <Ionicons
              name={showMicros ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textMuted}
            />
          </Pressable>

          {showMicros ? (
            <View style={styles.microsList}>
              {itemNutrients.fiber !== undefined ? (
                <MicroCompareRow
                  label="Dietary Fiber"
                  current={currentDayNutrients.fiber ?? 0}
                  added={itemNutrients.fiber}
                  unit="g"
                  rdi={DAILY_RECOMMENDED_INTAKE.fiber.value}
                  styles={styles}
                  colors={colors}
                />
              ) : null}
              {itemNutrients.sugar !== undefined ? (
                <MicroCompareRow
                  label="Sugars"
                  current={currentDayNutrients.sugar ?? 0}
                  added={itemNutrients.sugar}
                  unit="g"
                  rdi={DAILY_RECOMMENDED_INTAKE.sugar.value}
                  styles={styles}
                  colors={colors}
                />
              ) : null}
              {itemNutrients.saturated_fat !== undefined ? (
                <MicroCompareRow
                  label="Saturated Fat"
                  current={currentDayNutrients.saturated_fat ?? 0}
                  added={itemNutrients.saturated_fat}
                  unit="g"
                  rdi={DAILY_RECOMMENDED_INTAKE.saturated_fat.value}
                  styles={styles}
                  colors={colors}
                />
              ) : null}
              {itemNutrients.sodium !== undefined ? (
                <MicroCompareRow
                  label="Sodium"
                  current={currentDayNutrients.sodium ?? 0}
                  added={itemNutrients.sodium}
                  unit="mg"
                  rdi={DAILY_RECOMMENDED_INTAKE.sodium.value}
                  styles={styles}
                  colors={colors}
                />
              ) : null}
              {itemNutrients.potassium !== undefined ? (
                <MicroCompareRow
                  label="Potassium"
                  current={currentDayNutrients.potassium ?? 0}
                  added={itemNutrients.potassium}
                  unit="mg"
                  rdi={DAILY_RECOMMENDED_INTAKE.potassium.value}
                  styles={styles}
                  colors={colors}
                />
              ) : null}
              {itemNutrients.calcium !== undefined ? (
                <MicroCompareRow
                  label="Calcium"
                  current={currentDayNutrients.calcium ?? 0}
                  added={itemNutrients.calcium}
                  unit="mg"
                  rdi={DAILY_RECOMMENDED_INTAKE.calcium.value}
                  styles={styles}
                  colors={colors}
                />
              ) : null}
              {itemNutrients.iron !== undefined ? (
                <MicroCompareRow
                  label="Iron"
                  current={currentDayNutrients.iron ?? 0}
                  added={itemNutrients.iron}
                  unit="mg"
                  rdi={DAILY_RECOMMENDED_INTAKE.iron.value}
                  styles={styles}
                  colors={colors}
                />
              ) : null}
              {itemNutrients.vitamin_c !== undefined ? (
                <MicroCompareRow
                  label="Vitamin C"
                  current={currentDayNutrients.vitamin_c ?? 0}
                  added={itemNutrients.vitamin_c}
                  unit="mg"
                  rdi={DAILY_RECOMMENDED_INTAKE.vitamin_c.value}
                  styles={styles}
                  colors={colors}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
})

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    cardHeader: {
      marginBottom: spacing.sm,
    },
    headerTitleWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    cardSubtitle: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    calorieHero: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    calorieTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    heroLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    heroTransition: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      marginTop: 2,
    },
    heroProjected: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
    },
    heroAdded: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    calorieBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    calorieBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    heroBarTrack: {
      height: 7,
      backgroundColor: colors.surface,
      borderRadius: 999,
      overflow: "hidden",
      flexDirection: "row",
      marginTop: 8,
    },
    heroBarSegment: {
      height: "100%",
    },
    macrosSection: {
      gap: spacing.sm,
    },
    macroRow: {
      gap: 4,
    },
    macroRowHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    labelGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    macroLabel: {
      fontSize: 12,
      fontWeight: "700",
    },
    valueGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    transitionText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    arrowText: {
      color: colors.textMuted,
      fontSize: 11,
    },
    projectedText: {
      fontWeight: "700",
      color: colors.text,
    },
    addedText: {
      fontSize: 11,
      fontWeight: "700",
    },
    budgetBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1.5,
      borderRadius: 6,
    },
    budgetBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    barTrack: {
      height: 5,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 999,
      overflow: "hidden",
      flexDirection: "row",
    },
    barSegment: {
      height: "100%",
    },
    microsAccordion: {
      marginTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.xs,
    },
    accordionBtn: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.xs,
    },
    accordionLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    accordionTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
    },
    microsList: {
      gap: spacing.sm,
      marginTop: spacing.xs,
      paddingTop: spacing.xs,
    },
    microRow: {
      gap: 2,
    },
    microHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    microLabel: {
      fontSize: 11,
      color: colors.text,
      fontWeight: "600",
    },
    microValues: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    microProjected: {
      fontWeight: "700",
      color: colors.text,
    },
    microAdded: {
      fontWeight: "700",
      color: colors.primary,
    },
    microBarTrack: {
      height: 4,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 999,
      overflow: "hidden",
      flexDirection: "row",
      marginTop: 2,
    },
    microBarSegment: {
      height: "100%",
    },
    rdiSub: {
      fontSize: 9,
      color: colors.textMuted,
      marginTop: 1,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
  })
