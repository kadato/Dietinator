import { memo, useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/hooks/useTheme"
import { parseDateKey, shiftDateKey, toDateKey } from "@/utils/date"
import { spacing, type ColorPalette } from "@/theme"

type Props = {
  selectedDateKey: string
  onSelectDate: (dateKey: string) => void
  onOpenDatePicker: () => void
}

type DayItem = {
  dateKey: string
  dayNumber: number
  weekdayLabel: string
  isToday: boolean
  isSelected: boolean
}

/**
 * Generates the 7 days of the week (Monday-first) containing the given date.
 */
function getWeekDays(centerDateKey: string, selectedDateKey: string, todayKey: string): DayItem[] {
  const center = parseDateKey(centerDateKey)
  // Get Monday of the current week (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const dayOfWeek = center.getDay()
  const distanceToMonday = (dayOfWeek + 6) % 7
  const monday = new Date(center)
  monday.setDate(center.getDate() - distanceToMonday)

  const days: DayItem[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const key = toDateKey(d)
    const label = d.toLocaleDateString(undefined, { weekday: "short" })
    days.push({
      dateKey: key,
      dayNumber: d.getDate(),
      weekdayLabel: label.slice(0, 3),
      isToday: key === todayKey,
      isSelected: key === selectedDateKey,
    })
  }
  return days
}

export const WeekCalendarStrip = memo(function WeekCalendarStrip({
  selectedDateKey,
  onSelectDate,
  onOpenDatePicker,
}: Props) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const todayKey = useMemo(() => toDateKey(), [])

  const days = useMemo(
    () => getWeekDays(selectedDateKey, selectedDateKey, todayKey),
    [selectedDateKey, todayKey],
  )

  const selectedDate = useMemo(() => parseDateKey(selectedDateKey), [selectedDateKey])
  const monthYearLabel = useMemo(
    () =>
      selectedDate.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [selectedDate],
  )

  const isCurrentDayToday = selectedDateKey === todayKey

  const shiftWeek = (deltaDays: number) => {
    onSelectDate(shiftDateKey(selectedDateKey, deltaDays))
  }

  return (
    <View style={styles.container}>
      {/* Month header & navigation */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={onOpenDatePicker}
          style={styles.monthSelector}
          accessibilityRole="button"
          accessibilityLabel={`Selected month: ${monthYearLabel}. Tap to choose date.`}
        >
          <Text style={styles.monthText}>{monthYearLabel}</Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={colors.textMuted}
            style={{ marginLeft: 4 }}
          />
        </Pressable>

        <View style={styles.navGroup}>
          {!isCurrentDayToday ? (
            <Pressable
              onPress={() => onSelectDate(todayKey)}
              style={styles.todayButton}
              accessibilityRole="button"
              accessibilityLabel="Jump to today"
            >
              <Text style={styles.todayButtonText}>Today</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => shiftWeek(-7)}
            hitSlop={8}
            style={styles.chevronButton}
            accessibilityRole="button"
            accessibilityLabel="Previous week"
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>

          <Pressable
            onPress={() => shiftWeek(7)}
            hitSlop={8}
            style={styles.chevronButton}
            accessibilityRole="button"
            accessibilityLabel="Next week"
          >
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* 7-Day horizontal strip */}
      <View style={styles.stripRow}>
        {days.map((item) => {
          return (
            <Pressable
              key={item.dateKey}
              onPress={() => onSelectDate(item.dateKey)}
              style={[
                styles.dayCard,
                item.isSelected ? styles.dayCardSelected : null,
                item.isToday && !item.isSelected ? styles.dayCardToday : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${item.weekdayLabel} ${item.dayNumber}${item.isToday ? " (Today)" : ""}`}
              accessibilityState={{ selected: item.isSelected }}
            >
              <Text
                style={[
                  styles.weekdayText,
                  item.isSelected
                    ? styles.weekdayTextSelected
                    : item.isToday
                      ? styles.weekdayTextToday
                      : null,
                ]}
              >
                {item.weekdayLabel}
              </Text>
              <Text
                style={[
                  styles.dayNumberText,
                  item.isSelected
                    ? styles.dayNumberTextSelected
                    : item.isToday
                      ? styles.dayNumberTextToday
                      : null,
                ]}
              >
                {item.dayNumber}
              </Text>
              {item.isToday ? (
                <View style={[styles.todayDot, item.isSelected ? styles.todayDotSelected : null]} />
              ) : (
                <View style={styles.placeholderDot} />
              )}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
})

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      marginBottom: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    monthSelector: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderRadius: 8,
    },
    monthText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    navGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    todayButton: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 14,
      backgroundColor: colors.surfaceAlt,
      marginRight: 4,
    },
    todayButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
    },
    chevronButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    stripRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 4,
    },
    dayCard: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      paddingHorizontal: 2,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 64,
    },
    dayCardSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    dayCardToday: {
      borderColor: colors.primaryMuted,
    },
    weekdayText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textMuted,
      marginBottom: 2,
      textTransform: "uppercase",
    },
    weekdayTextSelected: {
      color: colors.onPrimary,
      opacity: 0.9,
    },
    weekdayTextToday: {
      color: colors.primary,
    },
    dayNumberText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    dayNumberTextSelected: {
      color: colors.onPrimary,
    },
    dayNumberTextToday: {
      color: colors.primary,
    },
    todayDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
      marginTop: 4,
    },
    todayDotSelected: {
      backgroundColor: colors.onPrimary,
    },
    placeholderDot: {
      width: 4,
      height: 4,
      marginTop: 4,
    },
  })
