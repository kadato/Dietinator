import { useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { Feather } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { formatDisplayDate, parseDateKey, shiftDateKey, toDateKey } from "@/utils/date"
import { getCalorieHistory } from "@/db/stats"
import { getDiaryEntriesForDate } from "@/services/diary"
import type { DiaryEntry, MealType } from "@/types"
import { MEAL_LABELS, MEAL_TYPES } from "@/utils/meals"
import { spacing, fonts, type ColorPalette, borders, radii } from "@/theme"
import { useEscapeToClose } from "@/hooks/useEscapeToClose"
import { Fab } from "@/components/Fab"
import { FabCluster } from "@/components/FabCluster"
import { usePressedState } from "@/hooks/usePressedState"

type Props = {
  visible: boolean
  targetDateKey: string
  initialDateKey: string
  onCopy: (sourceDate: string, selectedIds: Set<string>) => void
  onClose: () => void
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const

function monthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = (firstDay.getDay() + 6) % 7
  const cells: (number | null)[] = Array.from({ length: lead }, () => null)
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function CopyFromDateModal({
  visible,
  targetDateKey,
  initialDateKey,
  onCopy,
  onClose,
}: Props) {
  useEscapeToClose(visible, onClose)
  const { colors } = useTheme()
  const { isMedium } = useLayout()
  const insets = useSafeAreaInsets()
  const safeBottom = insets.bottom
  const styles = useThemedStyles(createStyles)
  const prevPress = usePressedState()
  const nextPress = usePressedState()

  const [view, setView] = useState(() => {
    const d = parseDateKey(initialDateKey)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selected, setSelected] = useState(initialDateKey)
  const [calorieMap, setCalorieMap] = useState<Map<string, number>>(new Map())
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const todayKey = toDateKey()

  useEffect(() => {
    if (!visible) return
    const d = parseDateKey(initialDateKey)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset picker to initial date when opening
    setSelected(initialDateKey)
    setView({ year: d.getFullYear(), month: d.getMonth() })
  }, [visible, initialDateKey])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    getCalorieHistory(shiftDateKey(todayKey, -365))
      .then((rows) => {
        if (cancelled) return
        const map = new Map<string, number>()
        for (const r of rows) map.set(r.date, r.kcal)
        setCalorieMap(map)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [visible, todayKey])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show spinner while loading preview
    setPreviewLoading(true)
    getDiaryEntriesForDate(selected, { remote: false })
      .then((rows) => {
        if (cancelled) return
        setEntries(rows)
        setSelectedIds(new Set(rows.map((r) => r.id)))
      })
      .catch(() => {
        if (cancelled) return
        setEntries([])
        setSelectedIds(new Set())
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected, visible])

  const cells = useMemo(() => monthGrid(view.year, view.month), [view])

  const MONTHS_LONG = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ] as const
  const monthLabel = `${MONTHS_LONG[view.month]} ${view.year}`

  const shiftMonth = (delta: number) => {
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const totalKcal = entries.reduce((s, e) => s + e.kcal, 0)
  const count = entries.length
  const selectedCount = selectedIds.size
  const selectedKcal = useMemo(
    () => entries.filter((e) => selectedIds.has(e.id)).reduce((s, e) => s + e.kcal, 0),
    [entries, selectedIds],
  )
  const isSameDay = selected === targetDateKey
  const canCopy = selectedCount > 0 && !isSameDay

  const grouped = useMemo(() => {
    const map: Record<string, DiaryEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [] }
    for (const e of entries) {
      if (map[e.meal_type]) map[e.meal_type].push(e)
    }
    return map
  }, [entries])

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleMeal = (meal: MealType) => {
    const list = grouped[meal] ?? []
    const ids = list.map((e) => e.id)
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      return next
    })
  }

  const toggleAll = () => {
    if (selectedCount === count && count > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)))
    }
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
          accessibilityLabel="Dismiss copy picker"
        />
        <View
          accessibilityViewIsModal={true}
          style={[
            styles.centerWrap,
            {
              justifyContent: isMedium ? "center" : "flex-end",
              paddingBottom: isMedium ? 24 : safeBottom + 84,
            },
          ]}
        >
          <View style={styles.sheet}>
            <View style={styles.headerRow}>
              <Feather name="copy" size={16} color={colors.primary} />
              <Text style={styles.headerTitle}>Copy from date</Text>
              <Text style={styles.headerSubtitle}>to {formatDisplayDate(targetDateKey)}</Text>
            </View>

            <View style={styles.monthRow}>
              <Pressable
                onPress={() => shiftMonth(-1)}
                hitSlop={10}
                onPressIn={prevPress.onPressIn}
                onPressOut={prevPress.onPressOut}
                style={[styles.navBtn, prevPress.pressed && styles.navBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
              >
                <Feather name="chevron-left" size={20} color={colors.text} />
              </Pressable>
              <Text style={styles.monthLabel}>{monthLabel}</Text>
              <Pressable
                onPress={() => shiftMonth(1)}
                hitSlop={10}
                onPressIn={nextPress.onPressIn}
                onPressOut={nextPress.onPressOut}
                style={[styles.navBtn, nextPress.pressed && styles.navBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Next month"
              >
                <Feather name="chevron-right" size={20} color={colors.text} />
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
                const isSelected = key === selected
                const isToday = key === todayKey
                const isTarget = key === targetDateKey
                const hasEntries = (calorieMap.get(key) ?? 0) > 0
                const cellStyle = isSelected
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : isTarget
                    ? {
                        borderWidth: borders.width,
                        borderColor: colors.warning,
                        backgroundColor: `${colors.warning}14`,
                      }
                    : isToday
                      ? {
                          borderWidth: borders.width,
                          borderColor: colors.primary,
                          backgroundColor: "transparent",
                        }
                      : null
                const dayTextStyle = isSelected
                  ? { color: colors.onPrimary, fontWeight: "700" as const }
                  : isTarget
                    ? { color: colors.warning, fontWeight: "700" as const }
                    : isToday
                      ? { color: colors.primary, fontWeight: "700" as const }
                      : null
                return (
                  <Pressable
                    key={key}
                    hitSlop={4}
                    style={cellStyle ? { ...styles.cell, ...cellStyle } : styles.cell}
                    onPress={() => setSelected(key)}
                    accessibilityRole="button"
                    accessibilityLabel={key}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={dayTextStyle ? { ...styles.dayText, ...dayTextStyle } : styles.dayText}
                    >
                      {day}
                    </Text>
                    {hasEntries ? (
                      <View
                        style={[
                          styles.dot,
                          {
                            backgroundColor: isSelected ? colors.onPrimary : colors.primary,
                          },
                        ]}
                      />
                    ) : null}
                  </Pressable>
                )
              })}
            </View>

            <View style={styles.previewWrap}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewTitle}>{formatDisplayDate(selected)}</Text>
                <View style={styles.previewHeaderRight}>
                  {previewLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={[styles.previewMeta, isSameDay && { color: colors.warning }]}>
                      {isSameDay
                        ? "Same as target"
                        : count === 0
                          ? "Nothing logged"
                          : `${selectedCount} of ${count} · ${Math.round(selectedKcal)} kcal`}
                    </Text>
                  )}
                </View>
              </View>

              {count > 0 ? (
                <View style={styles.selectAllRow}>
                  <Pressable
                    onPress={toggleAll}
                    hitSlop={8}
                    className="flex-row items-center gap-1.5 active:opacity-70"
                    accessibilityRole="button"
                    accessibilityLabel={selectedCount === count ? "Deselect all" : "Select all"}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: selectedCount === count ? colors.primary : "transparent",
                          borderColor: selectedCount === count ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      {selectedCount === count ? (
                        <Feather name="check" size={12} color={colors.onPrimary} />
                      ) : null}
                    </View>
                    <Text style={styles.selectAllText}>
                      {selectedCount === count ? "Deselect all" : "Select all"}
                    </Text>
                  </Pressable>
                  <Text style={styles.previewMetaSmall}>
                    {selectedCount} selected · {Math.round(totalKcal)} total
                  </Text>
                </View>
              ) : null}

              <View style={styles.previewContent}>
                {count === 0 ? (
                  <View style={styles.emptyPreview}>
                    <Feather name="inbox" size={20} color={colors.textMuted} />
                    <Text style={styles.emptyText}>
                      No meals on this day. Pick another with a dot.
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.previewList}
                    contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {MEAL_TYPES.map((meal) => {
                      const list = grouped[meal]
                      if (!list || list.length === 0) return null
                      const mealIds = list.map((e) => e.id)
                      const allMealSelected = mealIds.every((id) => selectedIds.has(id))
                      const mealSelectedKcal = list
                        .filter((e) => selectedIds.has(e.id))
                        .reduce((s, e) => s + e.kcal, 0)
                      return (
                        <View key={meal} style={styles.mealBlock}>
                          <Pressable
                            onPress={() => toggleMeal(meal as MealType)}
                            hitSlop={8}
                            className="flex-row items-center justify-between active:opacity-70"
                            accessibilityRole="button"
                            accessibilityLabel={`Toggle ${MEAL_LABELS[meal]}`}
                          >
                            <View className="flex-row items-center gap-1.5">
                              <View
                                style={[
                                  styles.checkboxSm,
                                  {
                                    backgroundColor: allMealSelected ? colors[meal] : "transparent",
                                    borderColor: allMealSelected ? colors[meal] : colors.border,
                                  },
                                ]}
                              >
                                {allMealSelected ? (
                                  <Feather name="check" size={10} color={colors.surface} />
                                ) : null}
                              </View>
                              <Text style={[styles.mealLabel, { color: colors[meal] }]}>
                                {MEAL_LABELS[meal].toUpperCase()}
                              </Text>
                            </View>
                            <Text style={styles.mealKcalSmall}>
                              {mealSelectedKcal > 0 ? `${Math.round(mealSelectedKcal)} kcal` : ""}
                            </Text>
                          </Pressable>
                          {list.slice(0, 6).map((e) => {
                            const checked = selectedIds.has(e.id)
                            return (
                              <Pressable
                                key={e.id}
                                onPress={() => toggleId(e.id)}
                                className="flex-row items-center gap-2 active:opacity-70"
                                style={styles.entryRow}
                                accessibilityRole="button"
                                accessibilityLabel={`${checked ? "Selected" : "Not selected"} ${e.food_name}`}
                                accessibilityState={{ selected: checked }}
                              >
                                <View
                                  style={[
                                    styles.checkbox,
                                    {
                                      backgroundColor: checked ? colors.primary : "transparent",
                                      borderColor: checked ? colors.primary : colors.border,
                                    },
                                  ]}
                                >
                                  {checked ? (
                                    <Feather name="check" size={12} color={colors.onPrimary} />
                                  ) : null}
                                </View>
                                <Text
                                  style={[styles.entryName, !checked && { opacity: 0.5 }]}
                                  numberOfLines={1}
                                >
                                  {e.food_name}
                                </Text>
                                <Text style={[styles.entryKcal, !checked && { opacity: 0.5 }]}>
                                  {Math.round(e.kcal)} kcal
                                </Text>
                              </Pressable>
                            )
                          })}
                          {list.length > 6 ? (
                            <Text style={styles.moreText}>+{list.length - 6} more</Text>
                          ) : null}
                        </View>
                      )
                    })}
                  </ScrollView>
                )}
                {previewLoading ? (
                  <View style={styles.loadingOverlay} pointerEvents="none">
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                className="flex-1 items-center justify-center active:opacity-80"
                style={{
                  height: 44,
                  borderWidth: borders.width,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  borderRadius: radii.none,
                }}
                accessibilityRole="button"
                accessibilityLabel="Cancel copy"
              >
                <Text
                  style={{
                    fontFamily: fonts.mono,
                    fontWeight: "700",
                    fontSize: 13,
                    letterSpacing: 0.06,
                    textTransform: "uppercase",
                    color: colors.text,
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!canCopy) return
                  onCopy(selected, selectedIds)
                  onClose()
                }}
                disabled={!canCopy}
                className="flex-1 items-center justify-center active:opacity-80"
                style={{
                  height: 44,
                  borderWidth: borders.width,
                  borderColor: canCopy ? colors.primary : colors.border,
                  backgroundColor: canCopy ? colors.primary : colors.surfaceAlt,
                  borderRadius: radii.none,
                  opacity: canCopy ? 1 : 0.5,
                }}
                accessibilityRole="button"
                accessibilityLabel={`Copy ${selectedCount} items to ${formatDisplayDate(targetDateKey)}`}
              >
                <Text
                  style={{
                    fontFamily: fonts.mono,
                    fontWeight: "700",
                    fontSize: 13,
                    letterSpacing: 0.06,
                    textTransform: "uppercase",
                    color: canCopy ? colors.onPrimary : colors.textMuted,
                  }}
                >
                  {selectedCount > 0 ? `Copy ${selectedCount}` : "Copy"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <FabCluster
          bottomOffset={safeBottom + 16}
          left={
            <Fab icon="x" tone="surface" onPress={onClose} accessibilityLabel="Close copy picker" />
          }
        />
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
      padding: 16,
      pointerEvents: "box-none",
    },
    sheet: {
      backgroundColor: colors.surface,
      borderRadius: radii.none,
      borderWidth: borders.width,
      borderColor: colors.border,
      padding: spacing.md,
      width: "100%",
      maxWidth: 420,
      maxHeight: "88%",
      alignSelf: "center",
      elevation: 0,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: spacing.sm,
    },
    headerTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: fonts.mono,
      marginLeft: 2,
    },
    monthRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
      borderRadius: radii.none,
    },
    navBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.none,
      borderWidth: borders.width,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      elevation: 0,
    },
    navBtnPressed: {
      opacity: 0.7,
    },
    monthLabel: {
      flex: 1,
      textAlign: "center",
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    weekRow: {
      flexDirection: "row",
      marginBottom: spacing.xs,
    },
    weekday: {
      flex: 1,
      textAlign: "center",
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    cell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.none,
      borderWidth: borders.width,
      borderColor: "transparent",
      elevation: 0,
      paddingBottom: 4,
    },
    dayText: {
      fontSize: 14,
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.2,
    },
    dot: {
      position: "absolute",
      bottom: 3,
      width: 4,
      height: 4,
      borderRadius: 0,
    },
    previewWrap: {
      marginTop: spacing.md,
      borderWidth: borders.width,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      padding: spacing.sm,
      height: 260,
    },
    previewHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    previewHeaderRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    previewTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.04,
    },
    previewMeta: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    previewMetaSmall: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    selectAllRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
      minHeight: 44,
      borderBottomWidth: borders.widthThin,
      borderBottomColor: colors.border,
      marginBottom: 6,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderWidth: borders.width,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.none,
    },
    checkboxSm: {
      width: 22,
      height: 22,
      borderWidth: borders.width,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.none,
    },
    selectAllText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.text,
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.04,
    },
    previewContent: {
      flex: 1,
      position: "relative",
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: `${colors.surfaceAlt}AA`,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyPreview: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 32,
      justifyContent: "center",
    },
    emptyText: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: fonts.mono,
      textAlign: "center",
    },
    previewList: {
      flex: 1,
    },
    mealBlock: {
      gap: 4,
    },
    mealLabel: {
      fontSize: 11,
      fontWeight: "700",
      fontFamily: fonts.mono,
      letterSpacing: 0.06,
      textTransform: "uppercase",
    },
    mealKcalSmall: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    entryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 8,
      minHeight: 44,
      backgroundColor: colors.surface,
      borderWidth: borders.widthThin,
      borderColor: colors.border,
    },
    entryName: {
      flex: 1,
      fontSize: 12,
      color: colors.text,
      fontFamily: fonts.mono,
    },
    entryKcal: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    moreText: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.04,
      paddingLeft: 26,
    },
    actions: {
      flexDirection: "row",
      gap: 8,
      marginTop: spacing.md,
    },
    legend: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: spacing.sm,
      justifyContent: "center",
    },
    legendText: {
      fontSize: 10,
      color: colors.textMuted,
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.04,
      marginRight: 8,
    },
    legendBox: {
      width: 12,
      height: 12,
      borderWidth: borders.widthThin,
    },
  })
