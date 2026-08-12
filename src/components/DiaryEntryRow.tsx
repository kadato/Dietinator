import { memo } from "react"
import { Pressable, Text, View, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { DiaryEntry } from "@/types"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useTheme } from "@/hooks/useTheme"
import { spacing, type ColorPalette } from "@/theme"

type Props = {
  entry: DiaryEntry
  accentColor: string
  onEdit: (entryId: string) => void
  onDelete: (entryId: string) => void
}

export const DiaryEntryRow = memo(function DiaryEntryRow({
  entry,
  accentColor,
  onEdit,
  onDelete,
}: Props) {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const amountLabel = entry.unit === "serving" ? "1 serving" : `${entry.amount}${entry.unit}`

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onEdit(entry.id)}
        onLongPress={() => onDelete(entry.id)}
        style={({ pressed }) => [styles.main, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${entry.food_name}, ${Math.round(entry.kcal)} calories`}
        accessibilityHint="Tap to edit, long press to delete"
      >
        <View style={[styles.iconWrap, { backgroundColor: accentColor + "22" }]}>
          <Ionicons name="nutrition-outline" size={18} color={accentColor} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {entry.food_name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {amountLabel} · P {entry.protein}g · C {entry.carbs}g · F {entry.fat}g
          </Text>
        </View>
        <View style={styles.kcalPill}>
          <Text style={styles.kcalValue}>{Math.round(entry.kcal)}</Text>
          <Text style={styles.kcalUnit}>kcal</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => onDelete(entry.id)}
        hitSlop={8}
        style={({ pressed }) => [styles.deleteBtn, pressed && styles.deletePressed]}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${entry.food_name}`}
      >
        <Ionicons name="trash-outline" size={16} color={colors.danger} />
      </Pressable>
    </View>
  )
})

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: 10,
    },
    main: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderRadius: 10,
    },
    rowPressed: { backgroundColor: colors.surfaceAlt },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    info: { flex: 1, minWidth: 0 },
    name: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      lineHeight: 20,
    },
    meta: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 3,
    },
    kcalPill: {
      alignItems: "flex-end",
      minWidth: 52,
    },
    kcalValue: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    kcalUnit: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    deleteBtn: {
      padding: 8,
      marginLeft: spacing.xs,
      opacity: 0.7,
    },
    deletePressed: {
      opacity: 1,
      transform: [{ scale: 0.92 }],
    },
  })
