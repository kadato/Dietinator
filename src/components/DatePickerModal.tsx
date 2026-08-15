import { useMemo, useState } from "react"
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/hooks/useTheme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { parseDateKey, toDateKey } from "@/utils/date"
import { spacing, type ColorPalette } from "@/theme"

type Props = {
  visible: boolean
  dateKey: string
  onSelect: (dateKey: string) => void
  onClose: () => void
}

/**
 * Monday-first short weekday labels from the device locale ("Mo", "Di", ...)
 * instead of hardcoded English — the month label already follows the locale.
 * Jan 8 2024 was a Monday.
 */
const WEEKDAYS = Array.from({ length: 7 }, (_, index) => {
  const label = new Date(2024, 0, 8 + index).toLocaleDateString(undefined, {
    weekday: "short",
  })
  return label.slice(0, 2).charAt(0).toUpperCase() + label.slice(1, 2).toLowerCase()
})

function monthGrid(year: number, month: number): (number | null)[] {
  // Month is 0-indexed here. Monday-first weeks.
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = (firstDay.getDay() + 6) % 7
  const cells: (number | null)[] = Array.from({ length: lead }, () => null)
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function DatePickerModal({ visible, dateKey, onSelect, onClose }: Props) {
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const selected = parseDateKey(dateKey)
  const [view, setView] = useState({ year: selected.getFullYear(), month: selected.getMonth() })
  const todayKey = toDateKey()

  const cells = useMemo(() => monthGrid(view.year, view.month), [view])
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })

  const shiftMonth = (delta: number) => {
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const pick = (day: number) => {
    const key = toDateKey(new Date(view.year, view.month, day))
    onSelect(key)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      {...(Platform.OS === "android"
        ? { statusBarTranslucent: true, hardwareAccelerated: true }
        : {})}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss date picker"
        />
        <View pointerEvents="box-none" style={styles.centerWrap}>
          <View style={styles.sheet}>
            <View style={styles.monthRow}>
              <Pressable
                onPress={() => shiftMonth(-1)}
                hitSlop={10}
                style={styles.navBtn}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
              >
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </Pressable>
              <Text style={styles.monthLabel}>{monthLabel}</Text>
              <Pressable
                onPress={() => shiftMonth(1)}
                hitSlop={10}
                style={styles.navBtn}
                accessibilityRole="button"
                accessibilityLabel="Next month"
              >
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((label) => (
                <Text key={label} style={styles.weekday}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((day, index) => {
                if (day === null) return <View key={`blank-${index}`} style={styles.cell} />
                const key = toDateKey(new Date(view.year, view.month, day))
                const isSelected = key === dateKey
                const isToday = key === todayKey
                const cellStyle = isSelected
                  ? { backgroundColor: colors.primary }
                  : isToday
                    ? { borderWidth: 1, borderColor: colors.primary }
                    : null
                const dayTextStyle = isSelected
                  ? { color: colors.onPrimary, fontWeight: "700" as const }
                  : isToday
                    ? { color: colors.primary, fontWeight: "700" as const }
                    : null
                return (
                  <Pressable
                    key={key}
                    style={cellStyle ? { ...styles.cell, ...cellStyle } : styles.cell}
                    onPress={() => pick(day)}
                    accessibilityRole="button"
                    accessibilityLabel={key}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={dayTextStyle ? { ...styles.dayText, ...dayTextStyle } : styles.dayText}
                    >
                      {day}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <Pressable
              style={styles.todayBtn}
              onPress={() => {
                onSelect(todayKey)
                onClose()
              }}
              accessibilityRole="button"
              accessibilityLabel="Go to today"
            >
              <Text style={styles.todayText}>Today</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    modalRoot: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    centerWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: spacing.md,
      width: "100%",
      maxWidth: 380,
      alignSelf: "center",
      boxShadow: "0px 6px 12px rgba(0, 0, 0, 0.25)",
      elevation: 8,
    },
    monthRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    navBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 20,
    },
    monthLabel: {
      flex: 1,
      textAlign: "center",
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    weekRow: {
      flexDirection: "row",
      marginBottom: spacing.xs,
    },
    weekday: {
      flex: 1,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    cell: {
      width: `${100 / 7}%`,
      aspectRatio: 1.05,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
    },
    dayText: {
      fontSize: 15,
      color: colors.text,
    },
    todayBtn: {
      alignSelf: "center",
      marginTop: spacing.sm,
      paddingHorizontal: 20,
      paddingVertical: spacing.sm,
      borderRadius: 20,
      backgroundColor: colors.primary,
    },
    todayText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.onPrimary,
    },
  })
