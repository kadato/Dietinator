import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Keyboard, Platform, Pressable, RefreshControl, ScrollView, View } from "react-native"
import { LoadingSpinner } from "@/components/LoadingSpinner"
import { useFocusEffect, useRouter } from "expo-router"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CalorieRing } from "@/components/CalorieRing"
import { MacroBar } from "@/components/MacroBar"
import { MealSection } from "@/components/MealSection"
import { OfflineBanner } from "@/components/OfflineBanner"
import { PageContainer } from "@/components/PageContainer"
import { DatePickerModal } from "@/components/DatePickerModal"
import { LogWeightModal } from "@/components/LogWeightModal"
import { LogWaterModal } from "@/components/LogWaterModal"
import { MealSlotModal } from "@/components/MealSlotModal"
import { Fab } from "@/components/Fab"
import { FabCluster } from "@/components/FabCluster"
import { useApp } from "@/context/AppContext"
import { importDiaryFromYazio, type MealGoals, type YazioDailySummary } from "@/services/yazio/sync"
import { pullAgentChanges } from "@/services/agent-bridge"
import { useToast } from "@/context/ToastContext"
import type { DiaryEntry, MealType, WeightEntry } from "@/types"
import {
  copyEntriesToDate,
  deleteFoodEntry,
  getDiaryEntriesForDate,
  restoreFoodEntry,
} from "@/services/diary"
import { getLatestWeightEntry, getRecentWeightEntries } from "@/db/weight"
import { addWaterEntry, deleteWaterEntry, getWaterTotalForDate } from "@/db/water"
import { getCalorieHistory } from "@/db/stats"
import { computeLogStreak } from "@/utils/adherence"
import { confirmAction } from "@/utils/confirm"
import { shiftDateKey, toDateKey, formatDisplayDate, formatHeaderDate } from "@/utils/date"
import { sumNutrients } from "@/utils/nutrients"
import { formatWaterAmount, formatWeight } from "@/utils/units"
import { MEAL_TYPES } from "@/utils/meals"
import { useLayout } from "@/hooks/useLayout"
import { useTheme } from "@/hooks/useTheme"
import { spacing, layout, fonts } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Card } from "@ui/card"

export default function TodayScreen() {
  const router = useRouter()
  const { settings, yazioAvailable, authenticated } = useApp()
  const { showError, showWarning, showUndo } = useToast()
  const { colors } = useTheme()
  const { isWide, width } = useLayout()
  // Phone metrics below the medium breakpoint. The date chrome, quick-adds
  // and dock are thumb-first. At 390, standard phone, the non-compact header
  // overflows and clips the streak badge against the viewport edge.
  const compact = width < layout.breakpointMedium
  const [dateKey, setDateKey] = useState(toDateKey())
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [mealGoals, setMealGoals] = useState<MealGoals>({})
  const [summary, setSummary] = useState<YazioDailySummary | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [streak, setStreak] = useState(0)
  const [localWeight, setLocalWeight] = useState<WeightEntry | null>(null)
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([])
  const [logWeightOpen, setLogWeightOpen] = useState(false)
  const [logWaterOpen, setLogWaterOpen] = useState(false)
  const [logSlotOpen, setLogSlotOpen] = useState(false)
  const [localWaterMl, setLocalWaterMl] = useState(0)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  // Session cache for the streak computation, see load() below.
  const streakCacheRef = useRef<{ day: string; count: number } | null>(null)

  const totals = useMemo(() => sumNutrients(entries), [entries])

  const mealEntries = useMemo(() => {
    const grouped: Record<MealType, DiaryEntry[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    }
    for (const entry of entries) {
      grouped[entry.meal_type]?.push(entry)
    }
    return grouped
  }, [entries])

  const load = useCallback(
    async (options?: { quiet?: boolean; force?: boolean }) => {
      // 1. Local first. The diary renders from SQLite before any network is
      //  touched. Stale nutrient values are refined in the background below.
      let list: DiaryEntry[]
      try {
        const [diaryEntries, weight, water, recentWeights] = await Promise.all([
          getDiaryEntriesForDate(dateKey, { remote: false }),
          getLatestWeightEntry(),
          getWaterTotalForDate(dateKey),
          getRecentWeightEntries(7),
        ])
        list = diaryEntries
        setEntries(list)
        setLocalWeight(weight)
        setLocalWaterMl(water)
        setWeightHistory(recentWeights.slice().reverse())
        // The streak depends only on which days up to today hold entries.
        // Cache per day plus today's entry count so tab focus never re-scans
        // a year of calorie history just to repaint one number.
        const today = toDateKey()
        const cached = streakCacheRef.current
        const todayCount = dateKey === today ? list.length : undefined
        if (
          !cached ||
          cached.day !== today ||
          (todayCount !== undefined && todayCount !== cached.count)
        ) {
          const calHistory = await getCalorieHistory(shiftDateKey(today, -365))
          setStreak(computeLogStreak(calHistory, today))
          streakCacheRef.current = { day: today, count: todayCount ?? -1 }
        }
      } catch (error) {
        showError(error, "Could not load diary for this day.")
        return
      } finally {
        setIsInitialLoading(false)
      }

      // 2. Background. Apply any changes external AI agents made through
      //  the /mcp endpoint, web only, then refine stale nutrients and
      //  import. Never blocks the render. Local rows painted first above,
      //  and a quiet local re-read surfaces agent edits once applied.
      await pullAgentChanges().catch(() => undefined)
      try {
        const afterAgents = await getDiaryEntriesForDate(dateKey, { remote: false })
        setEntries(afterAgents)
      } catch {
        // Local re-read is best-effort; the next focus reloads anyway.
      }
      if (!authenticated) return
      setImporting(true)
      try {
        const refreshed = await getDiaryEntriesForDate(dateKey)
        setEntries(refreshed)
        const result = await importDiaryFromYazio(dateKey, { force: options?.force })
        setMealGoals(result.mealGoals)
        setSummary(result.summary)
        // Imports wrote to SQLite. A final local read with no network is the
        // source of truth and also covers entries added while importing.
        if (result.imported > 0 || result.failed > 0 || result.error) {
          const updated = await getDiaryEntriesForDate(dateKey, { remote: false })
          setEntries(updated)
        }
        if (result.error && !options?.quiet) {
          showWarning(result.error, "YAZIO import")
        } else if (!options?.quiet && result.failed > 0) {
          showWarning(
            `${result.imported} imported, ${result.failed} could not be loaded. Try again.`,
            "Partial import",
          )
        }
      } catch {
        // Import errors are reported inside importDiaryFromYazio; never block the UI here.
      } finally {
        setImporting(false)
      }
    },
    [authenticated, dateKey, showError, showWarning],
  )

  useFocusEffect(
    useCallback(() => {
      load({ quiet: true })
    }, [load]),
  )

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardVisible(true),
    )
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardVisible(false),
    )
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  // Desktop affordance: left and right arrows page through diary days, the
  // same contract the chevron buttons offer. Web-only, and inert while any
  // modal is up or a text field owns the keyboard.
  useEffect(() => {
    if (Platform.OS !== "web") return
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      if (keyboardVisible) return
      if (pickerOpen || logWeightOpen || logWaterOpen || logSlotOpen) {
        return
      }
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      setDateKey((d) => shiftDateKey(d, event.key === "ArrowLeft" ? -1 : 1))
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [keyboardVisible, pickerOpen, logWeightOpen, logWaterOpen, logSlotOpen])

  const openAdd = useCallback(
    (mealType: MealType) => {
      router.push({
        pathname: "/log-meal",
        params: { meal: mealType, date: dateKey },
      })
    },
    [dateKey, router],
  )

  const openEdit = useCallback(
    (entryId: string) => {
      router.push({
        pathname: "/add-food",
        params: { entryId, date: dateKey },
      })
    },
    [dateKey, router],
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await load({ force: true })
    setRefreshing(false)
  }

  const onDeleteEntry = useCallback(
    (id: string) => {
      const entry = entries.find((e) => e.id === id)
      confirmAction({
        title: "Delete entry?",
        message: `Remove "${entry?.food_name ?? "this item"}" from the diary?`,
        confirmLabel: "Delete",
        onConfirm: async () => {
          try {
            await deleteFoodEntry(id)
            await load({ quiet: true })
            if (entry) {
              showUndo(`"${entry.food_name}" removed.`, () => {
                restoreFoodEntry(entry)
                  .then(() => load({ quiet: true }))
                  .catch(() => undefined)
              })
            }
          } catch (error) {
            showError(error, "Could not delete entry.")
          }
        },
      })
    },
    [entries, load, showError, showUndo],
  )

  const onCopyPrevious = useCallback(() => {
    const sourceDate = shiftDateKey(dateKey, -1)
    void (async () => {
      const sourceEntries = await getDiaryEntriesForDate(sourceDate, { remote: false })
      const count = sourceEntries.length
      confirmAction({
        title: "Copy previous day?",
        message:
          count === 0
            ? `Nothing was logged on ${formatDisplayDate(sourceDate)}, so there is nothing to copy.`
            : `Add ${count === 1 ? "1 item" : `${count} items`} from ${formatDisplayDate(sourceDate)} to ${formatDisplayDate(dateKey)}?`,
        confirmLabel: count > 0 ? "Copy" : "OK",
        onConfirm: async () => {
          if (count === 0) return
          try {
            await copyEntriesToDate(sourceDate, dateKey)
            await load({ quiet: true })
          } catch (error) {
            showError(error, "Could not copy entries.")
          }
        },
      })
    })()
  }, [dateKey, load, showError])

  const renderMealSections = (grid?: boolean) =>
    MEAL_TYPES.map((meal) => {
      const section = (
        <MealSection
          key={`${dateKey}-${meal}`}
          mealType={meal}
          dateKey={dateKey}
          entries={mealEntries[meal]}
          mealGoal={mealGoals[meal]}
          onAdd={openAdd}
          onEdit={openEdit}
          onDelete={onDeleteEntry}
        />
      )
      return grid ? (
        <View key={meal} className="min-w-[280px] grow basis-[48%]">
          {section}
        </View>
      ) : (
        section
      )
    })

  const yazioWeight = summary?.weight
  // Locally logged weigh-ins take precedence over the YAZIO profile weight.
  const displayedWeight = localWeight?.weight_kg ?? yazioWeight
  // Locally logged water wins; YAZIO's intake fills in until the first pour.
  const waterIntake = localWaterMl > 0 ? localWaterMl : (summary?.waterIntake ?? 0)
  const waterGoal = settings.water_goal_ml > 0 ? settings.water_goal_ml : (summary?.waterGoal ?? 0)
  const insets = useSafeAreaInsets()

  const handleQuickWater = async (amount: number) => {
    try {
      const entry = await addWaterEntry({ date: dateKey, amountMl: amount })
      await load({ quiet: true })
      showUndo(`${amount}ml water added.`, async () => {
        try {
          await deleteWaterEntry(entry.id)
          await load({ quiet: true })
        } catch {}
      })
    } catch (error) {
      showError(error, "Could not log water.")
    }
  }

  const dateChrome = (
    <Box
      className="mb-3 border bg-background-50 px-3 py-3"
      style={{
        borderWidth: 1.5,
        borderColor: colors.border,
        borderStyle: "solid",
        borderRadius: 0,
        backgroundColor: colors.surface,
      }}
    >
      <View className={`flex-row items-center ${compact ? "gap-1.5" : "gap-2.5"}`}>
        <Box className={`min-w-0 flex-1 flex-row items-center ${compact ? "gap-1.5" : "gap-2.5"}`}>
          <Pressable
            onPress={() => setDateKey((d) => shiftDateKey(d, -1))}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Previous day"
          >
            {({ pressed }) => (
              <Box
                className="items-center justify-center"
                style={{
                  width: compact ? 38 : 42,
                  height: compact ? 38 : 42,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderStyle: "solid",
                  borderRadius: 0,
                  backgroundColor: pressed ? `${colors.primary}20` : colors.surfaceAlt,
                }}
              >
                <Feather name="chevron-left" size={compact ? 18 : 20} color={colors.text} />
              </Box>
            )}
          </Pressable>

          <Pressable
            onPress={() => setPickerOpen(true)}
            hitSlop={6}
            className="min-w-0 flex-1"
            accessibilityRole="button"
            accessibilityLabel={`Selected date: ${formatHeaderDate(dateKey)}. Tap to open calendar.`}
          >
            {({ pressed }) => (
              <Box
                className="w-full flex-row items-center justify-center"
                style={{
                  height: compact ? 38 : 42,
                  paddingHorizontal: compact ? 10 : 14,
                  gap: 6,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderStyle: "solid",
                  borderRadius: 0,
                  backgroundColor: pressed ? `${colors.primary}20` : colors.surfaceAlt,
                }}
              >
                <Feather name="calendar" size={compact ? 14 : 17} color={colors.primary} />
                <Text
                  size={compact ? "xs" : "sm"}
                  bold
                  numberOfLines={1}
                  className="text-center text-typography-900"
                  style={{
                    fontSize: compact ? 13 : 15,
                    flexShrink: 1,
                    textAlign: "center",
                    fontFamily: fonts.mono,
                    textTransform: "uppercase",
                    letterSpacing: 0.04,
                  }}
                >
                  {compact ? formatDisplayDate(dateKey) : formatHeaderDate(dateKey)}
                </Text>
              </Box>
            )}
          </Pressable>

          <Pressable
            onPress={() => setDateKey((d) => shiftDateKey(d, 1))}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Next day"
          >
            {({ pressed }) => (
              <Box
                className="items-center justify-center"
                style={{
                  width: compact ? 38 : 42,
                  height: compact ? 38 : 42,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderStyle: "solid",
                  borderRadius: 0,
                  backgroundColor: pressed ? `${colors.primary}20` : colors.surfaceAlt,
                }}
              >
                <Feather name="chevron-right" size={compact ? 18 : 20} color={colors.text} />
              </Box>
            )}
          </Pressable>

          {streak > 0 ? (
            <Box
              className="flex-row items-center justify-center gap-1.5 px-2.5"
              style={{
                height: compact ? 38 : 42,
                borderWidth: 1.5,
                borderColor: colors.warning,
                borderStyle: "solid",
                borderRadius: 0,
                backgroundColor: `${colors.warning}18`,
              }}
              accessibilityRole="text"
              accessibilityLabel={`${streak} day logging streak`}
            >
              <MaterialCommunityIcons name="fire" size={compact ? 16 : 18} color={colors.warning} />
              <Text
                size={compact ? "xs" : "sm"}
                bold
                className="font-tabular leading-none"
                style={{
                  color: colors.warning,
                  fontFamily: fonts.mono,
                  fontWeight: "700",
                }}
              >
                {streak}
              </Text>
            </Box>
          ) : null}
        </Box>

        {authenticated ? (
          <Pressable
            onPress={() => load({ force: true })}
            disabled={importing || refreshing}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Refresh from YAZIO"
          >
            {({ pressed }) => (
              <Box
                className="items-center justify-center"
                style={{
                  width: compact ? 38 : 42,
                  height: compact ? 38 : 42,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  borderStyle: "solid",
                  borderRadius: 0,
                  backgroundColor: pressed ? `${colors.primary}20` : colors.surfaceAlt,
                }}
              >
                <Feather
                  name="download-cloud"
                  size={compact ? 16 : 18}
                  color={importing ? colors.textMuted : colors.primary}
                />
              </Box>
            )}
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={onCopyPrevious}
        hitSlop={8}
        className="mt-2.5 w-full"
        accessibilityRole="button"
        accessibilityLabel="Copy previous day's meals"
      >
        {({ pressed }) => (
          <Box
            className="w-full flex-row items-center justify-center"
            style={{
              height: 42,
              paddingHorizontal: 16,
              gap: 8,
              borderWidth: 1.5,
              borderColor: colors.border,
              borderStyle: "solid",
              borderRadius: 0,
              backgroundColor: pressed ? `${colors.primary}20` : colors.surfaceAlt,
            }}
          >
            <Feather name="copy" size={14} color={colors.primary} />
            <Text
              size="xs"
              bold
              className="font-mono uppercase tracking-widest text-typography-900"
              style={{ letterSpacing: 0.08, fontFamily: fonts.mono }}
            >
              Copy previous day
            </Text>
          </Box>
        )}
      </Pressable>
    </Box>
  )

  const summaryCard = (
    <Card
      variant="elevated"
      className="mb-3 overflow-hidden border p-0"
      style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
    >
      <Box className="items-center pt-6">
        <CalorieRing
          consumed={totals.kcal}
          goal={settings.calorie_goal}
          protein={totals.protein}
          carbs={totals.carbs}
          fat={totals.fat}
          size={isWide ? 168 : width < 380 ? 140 : 152}
        />
      </Box>

      <MacroBar
        protein={totals.protein}
        carbs={totals.carbs}
        fat={totals.fat}
        proteinGoal={settings.protein_goal}
        carbsGoal={settings.carbs_goal}
        fatGoal={settings.fat_goal}
      />

      {summary && summary.steps > 0 ? (
        <Box className="flex-row items-center justify-center gap-1.5 border-t border-outline-200 pb-3 pt-2.5">
          <Feather name="activity" size={12} color={colors.textMuted} />
          <Text
            size="2xs"
            bold
            className="font-mono uppercase tracking-widest text-typography-600"
            style={{ letterSpacing: 0.06 }}
          >
            {summary.steps.toLocaleString()} steps
          </Text>
          <Text size="2xs" className="font-mono uppercase tracking-widest text-typography-400">
            · today
          </Text>
        </Box>
      ) : null}
    </Card>
  )

  const hydrationRow = (
    <Box className={`mb-3 flex-row ${compact ? "gap-2" : "gap-2.5"}`}>
      <Box
        className={`min-w-0 flex-1 flex-row items-center rounded-none border bg-background-50 ${compact ? "p-2" : "p-2.5"}`}
        style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
      >
        <Pressable
          onPress={() => setLogWaterOpen(true)}
          className="min-w-0 flex-1 flex-row items-center gap-2 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={`Log water, ${formatWaterAmount(waterIntake, settings.units)} / ${
            waterGoal > 0 ? formatWaterAmount(waterGoal, settings.units) : "Water"
          }`}
        >
          <Box
            className="shrink-0 items-center justify-center rounded-none"
            style={{
              width: 44,
              height: 44,
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 0,
              backgroundColor: `${colors.primary}12`,
            }}
          >
            <Feather name="droplet" size={compact ? 16 : 18} color={colors.primary} />
          </Box>
          <Box className="min-w-0 flex-1">
            <Text size="sm" bold numberOfLines={1} className="font-tabular text-typography-900">
              {formatWaterAmount(waterIntake, settings.units)}{" "}
            </Text>
            <Text
              size="2xs"
              numberOfLines={1}
              className="font-mono uppercase tracking-widest text-typography-500"
            >
              {waterGoal > 0 ? `/ ${formatWaterAmount(waterGoal, settings.units)}` : "Water"}
            </Text>
          </Box>
        </Pressable>
        <Pressable
          onPress={() => void handleQuickWater(250)}
          hitSlop={8}
          className={`cursor-pointer items-center justify-center rounded-none border bg-primary-500 hover:bg-primary-600 active:bg-primary-600 ${compact ? "min-w-[52px] px-2" : "min-w-[56px] px-3"}`}
          style={{
            minHeight: 44,
            height: 44,
            borderWidth: 1.5,
            borderColor: colors.primary,
            borderRadius: 0,
          }}
          accessibilityRole="button"
          accessibilityLabel="Quick add 250ml water"
        >
          <Text
            size="2xs"
            bold
            className="font-mono uppercase leading-none tracking-widest"
            style={{ color: colors.onPrimary, letterSpacing: 0.06 }}
          >
            +250
          </Text>
          <Text
            size="2xs"
            className="font-mono uppercase leading-none tracking-widest"
            style={{ color: colors.onPrimary, letterSpacing: 0.06 }}
          >
            ml
          </Text>
        </Pressable>
      </Box>
      <Pressable
        onPress={() => setLogWeightOpen(true)}
        className={`min-w-0 flex-1 cursor-pointer rounded-none border bg-background-50 hover:bg-background-100 active:bg-background-100 ${compact ? "gap-2 p-2" : "gap-2.5 p-2.5"}`}
        style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
        accessibilityRole="button"
        accessibilityLabel={`Log weight, ${
          displayedWeight != null ? `${formatWeight(displayedWeight, settings.units)} weight` : ""
        }`}
      >
        <View className="w-full flex-row items-center gap-2">
          <Box
            className="shrink-0 items-center justify-center rounded-none"
            style={{
              width: 44,
              height: 44,
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 0,
              backgroundColor: `${colors.primary}12`,
            }}
          >
            <Feather name="activity" size={compact ? 16 : 18} color={colors.primary} />
          </Box>
          <Box className="min-w-0 flex-1">
            <Text size="sm" bold numberOfLines={1} className="font-tabular text-typography-900">
              {displayedWeight != null ? formatWeight(displayedWeight, settings.units) : "-"}
            </Text>
            <Text
              size="2xs"
              numberOfLines={1}
              className="font-mono uppercase tracking-widest text-typography-500"
              style={{ fontSize: 10, letterSpacing: 0.06 }}
            >
              {weightHistory.length > 1
                ? `${weightHistory.length} weigh-ins`
                : weightHistory.length === 1
                  ? "1 weigh-in"
                  : "Tap to log"}
            </Text>
          </Box>
        </View>
        {weightHistory.length >= 2 ? (
          <View className="mt-2 flex-row items-end gap-1" style={{ height: 18 }}>
            {(() => {
              const vals = weightHistory.slice(-7).map((w) => w.weight_kg)
              const min = Math.min(...vals)
              const max = Math.max(...vals)
              const range = max - min || 1
              return vals.map((v, i) => {
                const h = 6 + ((v - min) / range) * 12
                const isLast = i === vals.length - 1
                return (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: h,
                      backgroundColor: isLast ? colors.primary : `${colors.primary}55`,
                      borderWidth: 1,
                      borderColor: isLast ? colors.primary : `${colors.primary}40`,
                      borderRadius: 0,
                    }}
                  />
                )
              })
            })()}
          </View>
        ) : null}
      </Pressable>
    </Box>
  )

  const nutritionHeader = (
    <Box className="mb-3 flex-row items-center justify-between px-1">
      <Text size="xl" bold style={{ color: colors.textOnBackground }}>
        MEALS
      </Text>
      {/* No header-level log button here. Every meal card carries its own
          square add key and the FAB is the single primary path, so a third
          "+" with the same glyph only invited mis-taps. */}
    </Box>
  )

  return (
    <Box className="flex-1 bg-background-0">
      <OfflineBanner visible={!yazioAvailable} />
      <PageContainer variant={isWide ? "wide" : "default"} className="flex-1">
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerClassName={`w-full p-2 ${isWide ? "self-stretch max-w-none px-6 pb-16" : width < layout.breakpointMedium ? "self-center pb-24" : "self-center pb-56"}`}
          style={{ paddingTop: insets.top + spacing.xs }}
        >
          {isInitialLoading ? (
            <View
              style={{
                flex: 1,
                minHeight: 320,
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.md,
                paddingVertical: 48,
              }}
            >
              <LoadingSpinner size={40} />
              <Text
                size="2xs"
                bold
                className="font-mono uppercase tracking-widest text-typography-500"
                accessibilityRole="text"
              >
                Loading diary…
              </Text>
            </View>
          ) : isWide ? (
            <Box className="w-full flex-row items-start gap-4">
              <Box className="min-w-[340px] max-w-[460px] flex-[0.95] gap-0">
                {dateChrome}
                {summaryCard}
                {hydrationRow}
              </Box>
              <Box className="min-w-0 flex-[1.05]">
                {nutritionHeader}
                <Box className="flex-row flex-wrap gap-2">{renderMealSections(true)}</Box>
              </Box>
            </Box>
          ) : (
            <>
              {dateChrome}
              {summaryCard}
              {hydrationRow}
              {nutritionHeader}
              {/* Medium band (600-899): two meal columns fit, so sections
                  share rows instead of stacking full width. The wrap parent
                  is required: 48%-basis children do nothing in a column. */}
              {width >= layout.breakpointMedium ? (
                <Box className="w-full flex-row flex-wrap gap-2">{renderMealSections(true)}</Box>
              ) : (
                renderMealSections()
              )}
            </>
          )}
        </ScrollView>
      </PageContainer>

      <DatePickerModal
        visible={pickerOpen}
        dateKey={dateKey}
        onSelect={(key) => setDateKey(key)}
        onClose={() => setPickerOpen(false)}
      />

      <LogWeightModal
        visible={logWeightOpen}
        onClose={() => setLogWeightOpen(false)}
        onSaved={() => load({ quiet: true })}
      />

      <LogWaterModal
        visible={logWaterOpen}
        initialDateKey={dateKey}
        onClose={() => setLogWaterOpen(false)}
        onSaved={() => load({ quiet: true })}
      />

      <MealSlotModal
        visible={logSlotOpen}
        title="Log food into…"
        initialDateKey={dateKey}
        onSelect={(slot, targetDate) => {
          setLogSlotOpen(false)
          router.push({
            pathname: "/log-meal",
            params: { meal: slot, date: targetDate },
          })
        }}
        onClose={() => setLogSlotOpen(false)}
      />

      {!keyboardVisible ? (
        <FabCluster
          bottomOffset={isWide ? 20 : 8}
          right={
            <Fab
              size="md"
              icon="plus"
              onPress={() => setLogSlotOpen(true)}
              accessibilityLabel="Log food into diary"
            />
          }
        />
      ) : null}
    </Box>
  )
}
