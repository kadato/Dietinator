import { memo } from "react"
import { Pressable, Text, View, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { DiaryEntry } from "@/types"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useTheme } from "@/hooks/useTheme"
import { usePressedState } from "@/hooks/usePressedState"
import { formatNumber } from "@/utils/format"
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
  const amountLabel =
    entry.unit === "serving" ? "1 serving" : `${formatNumber(entry.amount)}${entry.unit}`
  const mainPress = usePressedState()
  const editPress = usePressedState()
  const deletePress = usePressedState()

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onEdit(entry.id)}
        onLongPress={() => onDelete(entry.id)}
        onPressIn={mainPress.onPressIn}
        onPressOut={mainPress.onPressOut}
        style={[styles.main, ...(mainPress.pressed ? [styles.rowPressed] : [])]}
        accessibilityRole="button"
        accessibilityLabel={`${entry.food_name}, ${Math.round(entry.kcal)} calories`}
        accessibilityHint="Tap to edit, long press to delete"
      >
        <View style={[styles.iconWrap, { backgroundColor: accentColor + "1f" }]}>
          <Ionicons name="nutrition-outline" size={17} color={accentColor} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {entry.food_name}
          </Text>
          <Text style={styles.meta}>
            {amountLabel} · P {formatNumber(entry.protein)}g · C {formatNumber(entry.carbs)}g · F{" "}
            {formatNumber(entry.fat)}g
          </Text>
        </View>
        <View style={styles.kcalBlock}>
          <Text style={styles.kcalValue}>{Math.round(entry.kcal)}</Text>
          <Text style={styles.kcalUnit}>Cal</Text>
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Pressable
          onPress={() => onEdit(entry.id)}
          hitSlop={4}
          onPressIn={editPress.onPressIn}
          onPressOut={editPress.onPressOut}
          style={[
            styles.actionBtn,
            { backgroundColor: `${accentColor}1a` },
            ...(editPress.pressed ? [styles.actionPressed] : []),
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${entry.food_name}`}
        >
          <Ionicons name="pencil-outline" size={14} color={accentColor} />
        </Pressable>
        <Pressable
          onPress={() => onDelete(entry.id)}
          hitSlop={4}
          onPressIn={deletePress.onPressIn}
          onPressOut={deletePress.onPressOut}
          style={[
            styles.actionBtn,
            { backgroundColor: `${colors.danger}1a` },
            ...(deletePress.pressed ? [styles.actionPressed] : []),
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${entry.food_name}`}
        >
          <Ionicons name="trash" size={14} color={colors.danger} />
        </Pressable>
      </View>
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
      width: 34,
      height: 34,
      borderRadius: 17,
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
      marginTop: 2,
    },
    kcalBlock: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 3,
    },
    kcalValue: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    kcalUnit: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textMuted,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginLeft: spacing.xs,
    },
    actionBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    actionPressed: {
      transform: [{ scale: 0.9 }],
    },
  })
