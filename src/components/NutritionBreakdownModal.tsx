import { memo } from "react"
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View, Text } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { createModalShellStyles } from "@/components/modal-shell"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { DAILY_RECOMMENDED_INTAKE } from "@/utils/nutrients"
import type { FoodNutrients } from "@/types"
import { spacing, type ColorPalette } from "@/theme"

type Props = {
  visible: boolean
  onClose: () => void
  nutrients: FoodNutrients
  title?: string
  subtitle?: string
}

function NutrientProgressBar({
  label,
  value,
  unit,
  rdi,
  color,
  styles,
}: {
  label: string
  value?: number
  unit: string
  rdi?: number
  color: string
  styles: ReturnType<typeof createStyles>
}) {
  const current = value ?? 0
  const pct = rdi && rdi > 0 ? Math.min(Math.round((current / rdi) * 100), 200) : null
  const formattedVal = Number.isInteger(current) ? String(current) : current.toFixed(1)

  return (
    <View style={styles.nutrientRow}>
      <View style={styles.nutrientHeader}>
        <View style={styles.labelCol}>
          <Text style={styles.nutrientLabel}>{label}</Text>
        </View>
        <View style={styles.valueCol}>
          <Text style={styles.nutrientValue}>
            {formattedVal} <Text style={styles.unitText}>{unit}</Text>
          </Text>
          {pct !== null ? (
            <Text style={[styles.rdiPct, { color: pct > 100 ? color : styles.rdiColor.color }]}>
              {pct}% RDI
            </Text>
          ) : null}
        </View>
      </View>
      {pct !== null ? (
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              {
                width: `${Math.min(pct, 100)}%`,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  )
}

export const NutritionBreakdownModal = memo(function NutritionBreakdownModal({
  visible,
  onClose,
  nutrients,
  title = "Nutrition & Micronutrients",
  subtitle,
}: Props) {
  const { colors } = useTheme()
  const shell = createModalShellStyles(colors)
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()
  const { isWide } = useLayout()

  const macroKcal = nutrients.protein * 4 + nutrients.carbs * 4 + nutrients.fat * 9
  const proteinPct = macroKcal > 0 ? Math.round(((nutrients.protein * 4) / macroKcal) * 100) : 0
  const carbsPct = macroKcal > 0 ? Math.round(((nutrients.carbs * 4) / macroKcal) * 100) : 0
  const fatPct = macroKcal > 0 ? Math.round(((nutrients.fat * 9) / macroKcal) * 100) : 0
  const netCarbs =
    nutrients.fiber !== undefined
      ? Math.max(0, Math.round((nutrients.carbs - nutrients.fiber) * 10) / 10)
      : nutrients.carbs

  const modalBody = (
    <View style={styles.modalBody}>
      {/* Top Drag Handle on Phone */}
      {!isWide && (
        <View style={styles.handleContainer}>
          <View style={styles.dragHandle} />
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.titleText}>{title}</Text>
          {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Close nutrition breakdown"
        >
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Energy Hero Card */}
        <View style={styles.energyCard}>
          <View>
            <Text style={styles.energyKcal}>{Math.round(nutrients.kcal)}</Text>
            <Text style={styles.energyLabel}>Total Calories (kcal)</Text>
          </View>
          <View style={styles.macroPillRow}>
            <View style={[styles.macroPill, { backgroundColor: `${colors.breakfast}18` }]}>
              <Text style={[styles.macroPillLabel, { color: colors.breakfast }]}>
                Protein {Math.round(nutrients.protein)}g ({proteinPct}%)
              </Text>
            </View>
            <View style={[styles.macroPill, { backgroundColor: `${colors.lunch}18` }]}>
              <Text style={[styles.macroPillLabel, { color: colors.lunch }]}>
                Carbs {Math.round(nutrients.carbs)}g ({carbsPct}%)
              </Text>
            </View>
            <View style={[styles.macroPill, { backgroundColor: `${colors.dinner}18` }]}>
              <Text style={[styles.macroPillLabel, { color: colors.dinner }]}>
                Fat {Math.round(nutrients.fat)}g ({fatPct}%)
              </Text>
            </View>
          </View>
        </View>

        {/* Section: Macronutrients & Sub-Macros */}
        <Text style={styles.sectionHeading}>Macronutrients</Text>
        <View style={styles.card}>
          <NutrientProgressBar
            label="Protein"
            value={nutrients.protein}
            unit="g"
            color={colors.breakfast}
            styles={styles}
          />
          <NutrientProgressBar
            label="Total Carbohydrates"
            value={nutrients.carbs}
            unit="g"
            color={colors.lunch}
            styles={styles}
          />
          {nutrients.fiber !== undefined ? (
            <NutrientProgressBar
              label="  ↳ Dietary Fiber"
              value={nutrients.fiber}
              unit="g"
              rdi={DAILY_RECOMMENDED_INTAKE.fiber.value}
              color={colors.primary}
              styles={styles}
            />
          ) : null}
          {nutrients.fiber !== undefined ? (
            <NutrientProgressBar
              label="  ↳ Net Carbs"
              value={netCarbs}
              unit="g"
              color={colors.lunch}
              styles={styles}
            />
          ) : null}
          {nutrients.sugar !== undefined ? (
            <NutrientProgressBar
              label="  ↳ Total Sugars"
              value={nutrients.sugar}
              unit="g"
              rdi={DAILY_RECOMMENDED_INTAKE.sugar.value}
              color={colors.warning}
              styles={styles}
            />
          ) : null}
          <NutrientProgressBar
            label="Total Fat"
            value={nutrients.fat}
            unit="g"
            color={colors.dinner}
            styles={styles}
          />
          {nutrients.saturated_fat !== undefined ? (
            <NutrientProgressBar
              label="  ↳ Saturated Fat"
              value={nutrients.saturated_fat}
              unit="g"
              rdi={DAILY_RECOMMENDED_INTAKE.saturated_fat.value}
              color={colors.danger}
              styles={styles}
            />
          ) : null}
          {nutrients.unsaturated_fat !== undefined ? (
            <NutrientProgressBar
              label="  ↳ Unsaturated Fat"
              value={nutrients.unsaturated_fat}
              unit="g"
              color={colors.dinner}
              styles={styles}
            />
          ) : null}
        </View>

        {/* Section: Key Minerals & Electrolytes */}
        <Text style={styles.sectionHeading}>Minerals & Electrolytes</Text>
        <View style={styles.card}>
          <NutrientProgressBar
            label="Sodium"
            value={nutrients.sodium}
            unit="mg"
            rdi={DAILY_RECOMMENDED_INTAKE.sodium.value}
            color={colors.primary}
            styles={styles}
          />
          <NutrientProgressBar
            label="Potassium"
            value={nutrients.potassium}
            unit="mg"
            rdi={DAILY_RECOMMENDED_INTAKE.potassium.value}
            color={colors.lunch}
            styles={styles}
          />
          <NutrientProgressBar
            label="Calcium"
            value={nutrients.calcium}
            unit="mg"
            rdi={DAILY_RECOMMENDED_INTAKE.calcium.value}
            color={colors.primary}
            styles={styles}
          />
          <NutrientProgressBar
            label="Iron"
            value={nutrients.iron}
            unit="mg"
            rdi={DAILY_RECOMMENDED_INTAKE.iron.value}
            color={colors.dinner}
            styles={styles}
          />
          <NutrientProgressBar
            label="Magnesium"
            value={nutrients.magnesium}
            unit="mg"
            rdi={DAILY_RECOMMENDED_INTAKE.magnesium.value}
            color={colors.breakfast}
            styles={styles}
          />
          <NutrientProgressBar
            label="Zinc"
            value={nutrients.zinc}
            unit="mg"
            rdi={DAILY_RECOMMENDED_INTAKE.zinc.value}
            color={colors.warning}
            styles={styles}
          />
          {nutrients.cholesterol !== undefined ? (
            <NutrientProgressBar
              label="Cholesterol"
              value={nutrients.cholesterol}
              unit="mg"
              rdi={DAILY_RECOMMENDED_INTAKE.cholesterol.value}
              color={colors.danger}
              styles={styles}
            />
          ) : null}
        </View>

        {/* Section: Vitamins */}
        <Text style={styles.sectionHeading}>Vitamins</Text>
        <View style={styles.card}>
          <NutrientProgressBar
            label="Vitamin A"
            value={nutrients.vitamin_a}
            unit="µg"
            rdi={DAILY_RECOMMENDED_INTAKE.vitamin_a.value}
            color={colors.lunch}
            styles={styles}
          />
          <NutrientProgressBar
            label="Vitamin C"
            value={nutrients.vitamin_c}
            unit="mg"
            rdi={DAILY_RECOMMENDED_INTAKE.vitamin_c.value}
            color={colors.warning}
            styles={styles}
          />
          <NutrientProgressBar
            label="Vitamin D"
            value={nutrients.vitamin_d}
            unit="µg"
            rdi={DAILY_RECOMMENDED_INTAKE.vitamin_d.value}
            color={colors.breakfast}
            styles={styles}
          />
          <NutrientProgressBar
            label="Vitamin B12"
            value={nutrients.vitamin_b12}
            unit="µg"
            rdi={DAILY_RECOMMENDED_INTAKE.vitamin_b12.value}
            color={colors.dinner}
            styles={styles}
          />
        </View>

        <Text style={styles.footnote}>
          * Daily Reference Values (% RDI) are based on standard adult dietary guidelines.
        </Text>
      </ScrollView>
    </View>
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWide ? "fade" : "slide"}
      onRequestClose={onClose}
      {...(Platform.OS === "android"
        ? { statusBarTranslucent: true, hardwareAccelerated: true }
        : {})}
    >
      <View style={shell.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss nutrition details"
        />
        {isWide ? (
          <View pointerEvents="box-none" style={shell.dialogWrap}>
            <View
              style={[
                shell.dialogBox,
                { width: "100%", maxWidth: 580, maxHeight: "88%", height: "88%" },
              ]}
            >
              {modalBody}
            </View>
          </View>
        ) : (
          <View pointerEvents="box-none" style={styles.phoneSheetWrap}>
            <View style={styles.phoneSheetBox}>{modalBody}</View>
          </View>
        )}
      </View>
    </Modal>
  )
})

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    phoneSheetWrap: {
      flex: 1,
      justifyContent: "flex-end",
      width: "100%",
    },
    phoneSheetBox: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      height: "85%",
      maxHeight: "88%",
      width: "100%",
      overflow: "hidden",
      boxShadow: "0px -4px 24px rgba(0, 0, 0, 0.25)",
      elevation: 16,
    },
    modalBody: {
      flex: 1,
      width: "100%",
    },
    handleContainer: {
      alignItems: "center",
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    dragHandle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitleWrap: {
      flex: 1,
      paddingRight: spacing.sm,
    },
    titleText: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    subtitleText: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    energyCard: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 20,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    energyKcal: {
      fontSize: 32,
      fontWeight: "800",
      color: colors.primary,
      fontVariant: ["tabular-nums"],
    },
    energyLabel: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.textMuted,
    },
    macroPillRow: {
      flexDirection: "column",
      gap: 4,
      alignItems: "flex-end",
    },
    macroPill: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
    },
    macroPillLabel: {
      fontSize: 11,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    sectionHeading: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
      marginLeft: spacing.xs,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    nutrientRow: {
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: `${colors.border}40`,
    },
    nutrientHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    labelCol: {
      flex: 1,
    },
    nutrientLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
    },
    valueCol: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    nutrientValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    unitText: {
      fontSize: 12,
      fontWeight: "400",
      color: colors.textMuted,
    },
    rdiPct: {
      fontSize: 12,
      fontWeight: "700",
      minWidth: 54,
      textAlign: "right",
      fontVariant: ["tabular-nums"],
    },
    rdiColor: {
      color: colors.textMuted,
    },
    barTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.surfaceAlt,
      marginTop: 6,
      overflow: "hidden",
    },
    barFill: {
      height: "100%",
      borderRadius: 2,
    },
    footnote: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
  })
