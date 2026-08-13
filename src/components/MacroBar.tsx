import { View, Text, StyleSheet } from "react-native"
import { useTheme } from "@/hooks/useTheme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { spacing, type ColorPalette } from "@/theme"

type MacroProps = {
  label: string
  value: number
  goal: number
  color: string
  styles: ReturnType<typeof createStyles>
}

function MacroRow({ label, value, goal, color, styles }: MacroProps) {
  const progress = goal > 0 ? Math.min(value / goal, 1) : 0
  const labelText =
    goal > 0 ? `${Math.round(value)} / ${Math.round(goal)} g` : `${Math.round(value)} g`
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{labelText}</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  )
}

type Props = {
  protein: number
  carbs: number
  fat: number
  proteinGoal: number
  carbsGoal: number
  fatGoal: number
}

/** Daily macro progress: one compact bar per macro. */
export function MacroBar({ protein, carbs, fat, proteinGoal, carbsGoal, fatGoal }: Props) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.container}>
      <MacroRow
        label="Protein"
        value={protein}
        goal={proteinGoal}
        color={colors.breakfast}
        styles={styles}
      />
      <MacroRow label="Carbs" value={carbs} goal={carbsGoal} color={colors.lunch} styles={styles} />
      <MacroRow label="Fat" value={fat} goal={fatGoal} color={colors.dinner} styles={styles} />
    </View>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: spacing.sm,
    },
    row: { gap: 6 },
    rowHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    label: { fontSize: 13, color: colors.text, fontWeight: "600", flexShrink: 0 },
    barBg: {
      height: 7,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 999,
      overflow: "hidden",
    },
    barFill: { height: "100%", borderRadius: 999 },
    value: { fontSize: 13, color: colors.textMuted, fontWeight: "500", flexShrink: 0 },
  })
