import { memo } from "react"
import { Pressable, Text, View, StyleSheet } from "react-native"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import type { DiaryEntry } from "@/types"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useTheme } from "@/hooks/useTheme"
import { usePressedState } from "@/hooks/usePressedState"
import { MacroPills } from "@/components/MacroPills"
import { formatNumber } from "@/utils/format"
import { getFoodIcon } from "@/utils/food-icon"
import { fonts, type ColorPalette } from "@/theme"

type Props = {
  entry: DiaryEntry
  accentColor: string
  onEdit: (entryId: string) => void
  onDelete: (entryId: string) => void
  onShowNutrition?: (entry: DiaryEntry) => void
}

export const DiaryEntryRow = memo(function DiaryEntryRow({
  entry,
  accentColor,
  onEdit,
  onDelete,
  onShowNutrition,
}: Props) {
  const styles = useThemedStyles(createStyles)
  const { colors } = useTheme()
  const amountLabel =
    entry.unit === "serving" ? "1 serving " : `${formatNumber(entry.amount)}${entry.unit} `
  const mainPress = usePressedState()
  const infoPress = usePressedState()
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
        accessibilityLabel={`${entry.food_name}, ${amountLabel.trim()}, ${formatNumber(entry.protein)}g ${formatNumber(entry.carbs)}g ${formatNumber(entry.fat)}g, ${Math.round(entry.kcal)} kcal`}
        accessibilityHint="Tap to edit, long press to delete"
      >
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: `${accentColor}14`,
              borderColor: colors.border,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={getFoodIcon(entry.food_name, entry)}
            size={20}
            color={accentColor}
          />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{entry.food_name}</Text>
          <View style={styles.macroRow}>
            <Text style={styles.amountLabel}>{amountLabel}</Text>
            <Text style={styles.macroDot}>,</Text>
            <MacroPills protein={entry.protein} carbs={entry.carbs} fat={entry.fat} size="xs" />
          </View>
        </View>
        <View style={styles.kcalBlock}>
          <Text style={styles.kcalValue}>{Math.round(entry.kcal)}</Text>
          <Text style={styles.kcalUnit}> kcal</Text>
        </View>
      </Pressable>
      <View style={styles.actions}>
        {onShowNutrition ? (
          <Pressable
            onPress={() => onShowNutrition(entry)}
            hitSlop={8}
            onPressIn={infoPress.onPressIn}
            onPressOut={infoPress.onPressOut}
            style={[
              styles.actionBtn,
              { backgroundColor: `${colors.primary}14`, borderColor: colors.border },
              ...(infoPress.pressed ? [styles.actionPressed] : []),
            ]}
            accessibilityRole="button"
            accessibilityLabel={`View nutrition facts for ${entry.food_name}`}
          >
            <Feather name="pie-chart" size={14} color={colors.primary} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => onEdit(entry.id)}
          hitSlop={8}
          onPressIn={editPress.onPressIn}
          onPressOut={editPress.onPressOut}
          style={[
            styles.actionBtn,
            { backgroundColor: `${accentColor}14`, borderColor: colors.border },
            ...(editPress.pressed ? [styles.actionPressed] : []),
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${entry.food_name}`}
        >
          <Feather name="edit-2" size={14} color={accentColor} />
        </Pressable>
        <Pressable
          onPress={() => onDelete(entry.id)}
          hitSlop={8}
          onPressIn={deletePress.onPressIn}
          onPressOut={deletePress.onPressOut}
          style={[
            styles.actionBtn,
            { backgroundColor: `${colors.danger}14`, borderColor: colors.border },
            ...(deletePress.pressed ? [styles.actionPressed] : []),
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${entry.food_name}`}
        >
          <Feather name="trash-2" size={14} color={colors.danger} />
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
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderRadius: 0,
      borderWidth: 0,
      boxShadow: "none",
      elevation: 0,
    },
    main: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 0,
      paddingVertical: 3,
      borderWidth: 1.5,
      borderColor: "transparent",
      boxShadow: "none",
      elevation: 0,
    },
    rowPressed: {
      backgroundColor: colors.surfaceAlt,
      opacity: 0.9,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 0,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "none",
      elevation: 0,
    },
    info: { flex: 1, minWidth: 0 },
    name: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
      lineHeight: 18,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    macroRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 4,
      marginTop: 2.5,
    },
    amountLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    macroDot: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: fonts.mono,
    },
    miniChip: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 0,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    miniChipText: {
      fontSize: 11,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    macroPill: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    kcalBlock: {
      alignItems: "flex-end",
      justifyContent: "center",
      paddingLeft: 4,
    },
    kcalValue: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    kcalUnit: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginLeft: 4,
    },
    actionBtn: {
      width: 30,
      height: 30,
      borderRadius: 0,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "none",
      elevation: 0,
    },
    actionPressed: {
      opacity: 0.7,
    },
  })
