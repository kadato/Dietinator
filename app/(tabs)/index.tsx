import { useCallback, useEffect, useMemo, useState } from "react"
import { Keyboard, Platform, Pressable, RefreshControl, ScrollView, View } from "react-native"
import { LoadingSpinner } from "@/components/LoadingSpinner"
import { useFocusEffect, useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
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
import { NutritionBreakdownModal } from "@/components/NutritionBreakdownModal"
import { Fab } from "@/components/Fab"
import { FabCluster } from "@/components/FabCluster"
import { useApp } from "@/context/AppContext"
import { importDiaryFromYazio, type MealGoals, type YazioDailySummary } from "@/services/yazio/sync"
import { pullAgentChanges } from "@/services/agent-bridge"
import { useToast } from "@/context/ToastContext"
import type { DiaryEntry, FoodNutrients, MealType, WeightEntry } from "@/types"
import {
  copyEntriesToDate,
  deleteFoodEntry,
  getDiaryEntriesForDate,
  getNutritionBreakdownForEntries,
  getNutritionBreakdownForEntry,
  restoreFoodEntry,
} from "@/services/diary"
import { getLatestWeightEntry } from "@/db/weight"
import { addWaterEntry, getWaterTotalForDate } from "@/db/water"
import { getCalorieHistory } from "@/db/stats"
import { computeLogStreak } from "@/utils/adherence"
import { confirmAction } from "@/utils/confirm"
import { shiftDateKey, toDateKey, formatDisplayDate, formatHeaderDate } from "@/utils/date"
import { sumNutrients } from "@/utils/nutrients"
import { formatWaterAmount, formatWeight } from "@/utils/units"
import { MEAL_TYPES } from "@/utils/meals"
import { useLayout } from "@/hooks/useLayout"
import { useTheme } from "@/hooks/useTheme"
import { spacing, layout } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Card } from "@ui/card"

export default function TodayScreen() {
  const router = useRouter()
  const { settings, yazioAvailable, authenticated } = useApp()
  const { showError, showWarning, showUndo } = useToast()
  const { colors } = useTheme()
  const { isWide, width } = useLayout()
  // Phone metrics below the medium breakpoint: the date chrome, quick-adds
  // and dock are thumb-first. At 390 (standard phone) the non-compact header
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
  const [logWeightOpen, setLogWeightOpen] = useState(false)
  const [logWaterOpen, setLogWaterOpen] = useState(false)
  const [logSlotOpen, setLogSlotOpen] = useState(false)
  const [localWaterMl, setLocalWaterMl] = useState(0)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [nutritionModal, setNutritionModal] = useState<{
    visible: boolean
    nutrients: FoodNutrients
    title?: string
    subtitle?: string
  }>({
    visible: false,
    nutrients: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  })

  const totals = useMemo(() => sumNutrients(entries), [entries])

  const handleShowItemNutrition = useCallback(async (entry: DiaryEntry) => {
    try {
      const nut = await getNutritionBreakdownForEntry(entry)
      setNutritionModal({
        visible: true,
        nutrients: nut,
        title: entry.food_name,
        subtitle: `${entry.amount} ${entry.unit} · ${Math.round(entry.kcal)} kcal`,
      })
    } catch {
      setNutritionModal({
        visible: true,
        nutrients: {
          kcal: entry.kcal,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
        },
        title: entry.food_name,
        subtitle: `${entry.amount} ${entry.unit} · ${Math.round(entry.kcal)} kcal`,
      })
    }
  }, [])

  const handleShowDayNutrition = useCallback(async () => {
    try {
      const nut = await getNutritionBreakdownForEntries(entries)
      setNutritionModal({
        visible: true,
        nutrients: nut,
        title: "Daily Nutrition and Micros",
        subtitle: `${formatDisplayDate(dateKey)} · ${entries.length} foods logged`,
      })
    } catch {
      setNutritionModal({
        visible: true,
        nutrients: totals,
        title: "Daily Nutrition and Micros",
        subtitle: `${formatDisplayDate(dateKey)} · ${entries.length} foods logged`,
      })
    }
  }, [dateKey, entries, totals])

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
      // 0. Agent bridge (web only): apply any changes external AI agents made
      //  through the /mcp endpoint before rendering the diary.
      await pullAgentChanges().catch(() => undefined)

      // 1. Local first. The diary renders from SQLite before any network is
      //  touched. Stale nutrient values are refined in the background below.
      let list: DiaryEntry[]
      try {
        const [diaryEntries, weight, water, calHistory] = await Promise.all([
          getDiaryEntriesForDate(dateKey, { remote: false }),
          getLatestWeightEntry(),
          getWaterTotalForDate(dateKey),
          getCalorieHistory(shiftDateKey(toDateKey(), -365)),
        ])
        list = diaryEntries
        setEntries(list)
        setLocalWeight(weight)
        setLocalWaterMl(water)
        setStreak(computeLogStreak(calHistory, toDateKey()))
      } catch (error) {
        showError(error, "Could not load diary for this day.")
        return
      } finally {
        setIsInitialLoading(false)
      }

      // 2. Background. Refine stale nutrients, then import. Never blocks the
      //  render; the import is throttled so tab switches don't re-hit YAZIO.
      if (!authenticated) return
      setImporting(true)
      try {
        const refreshed = await getDiaryEntriesForDate(dateKey)
        setEntries(refreshed)
        const result = await importDiaryFromYazio(dateKey, { force: options?.force })
        setMealGoals(result.mealGoals)
        setSummary(result.summary)
        // Imports wrote to SQLite. A final local read (no network) is the
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
          onShowNutrition={handleShowItemNutrition}
        />
      )
      return grid ? (
        <View key={meal} className="min-w-[320px] grow basis-[48%]">
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
      await addWaterEntry({ date: dateKey, amountMl: amount })
      await load({ quiet: true })
    } catch (error) {
      showError(error, "Could not log water.")
    }
  }

  const dateChrome = (
    <Box
      className="mb-3 border bg-background-50 px-3 py-3"
      style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
    >
      {/* Shrink-safe instrument row: the date pill is the only flexible item
          and truncates under pressure, so the streak and sync badges always
          fit inside the border instead of clipping out. */}
      <Box
        className={`min-w-0 flex-row items-center justify-between ${compact ? "gap-1.5" : "gap-2"}`}
      >
        <Box className={`min-w-0 shrink flex-row items-center ${compact ? "gap-0.5" : "gap-1"}`}>
          <Pressable
            onPress={() => setDateKey((d) => shiftDateKey(d, -1))}
            hitSlop={8}
            className={`shrink-0 items-center justify-center rounded-none border bg-background-100 active:bg-background-200 ${compact ? "h-9 w-9" : "h-11 w-11"}`}
            style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 0 }}
            accessibilityRole="button"
            accessibilityLabel="Previous day"
          >
            <Feather name="chevron-left" size={compact ? 16 : 18} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => setPickerOpen(true)}
            hitSlop={6}
            className={`min-w-0 shrink flex-row items-center rounded-none border bg-background-100 active:bg-background-200 ${compact ? "h-9 gap-1.5 px-3" : "h-11 gap-2 px-4"}`}
            style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
            accessibilityRole="button"
            accessibilityLabel={`Selected date: ${formatHeaderDate(dateKey)}. Tap to open calendar.`}
          >
            <Feather name="calendar" size={compact ? 14 : 17} color={colors.primary} />
            <Text
              size={compact ? "xs" : "sm"}
              bold
              numberOfLines={1}
              className="text-typography-900"
              style={{ fontSize: compact ? 13 : 16, flexShrink: 1 }}
            >
              {/* Compact phones get the short label: the full weekday string
                  cannot share one row with the streak and sync badges. */}
              {compact ? formatDisplayDate(dateKey) : formatHeaderDate(dateKey)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setDateKey((d) => shiftDateKey(d, 1))}
            hitSlop={8}
            className={`shrink-0 items-center justify-center rounded-none border bg-background-100 active:bg-background-200 ${compact ? "h-9 w-9" : "h-11 w-11"}`}
            style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 0 }}
            accessibilityRole="button"
            accessibilityLabel="Next day"
          >
            <Feather name="chevron-right" size={compact ? 16 : 18} color={colors.text} />
          </Pressable>
          {/* Streak sits in the same instrument row, with a clear gap before it. */}
          <Box
            className={`shrink-0 flex-row items-center gap-1 rounded-none border px-2.5 ${compact ? "ml-2.5 h-9" : "ml-4 h-11"}`}
            style={{
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 0,
              backgroundColor: streak > 0 ? `${colors.lunch}14` : `${colors.textMuted}12`,
            }}
            accessibilityRole="text"
            accessibilityLabel={`${streak} day logging streak`}
          >
            <Feather
              name="zap"
              size={compact ? 14 : 16}
              color={streak > 0 ? colors.lunch : colors.textMuted}
            />
            <Text
              size={compact ? "xs" : "sm"}
              bold
              className="font-tabular leading-none"
              style={{ color: streak > 0 ? colors.lunch : colors.textMuted }}
            >
              {streak}
            </Text>
          </Box>
        </Box>
        {authenticated ? (
          <Pressable
            onPress={() => load({ force: true })}
            disabled={importing || refreshing}
            hitSlop={8}
            className={`shrink-0 items-center justify-center rounded-none bg-background-100 active:bg-background-200 ${compact ? "h-9 w-9" : "h-11 w-11"}`}
            accessibilityRole="button"
            accessibilityLabel="Refresh from YAZIO"
          >
            <Feather
              name="download-cloud"
              size={compact ? 16 : 18}
              color={importing ? colors.textMuted : colors.primary}
            />
          </Pressable>
        ) : null}
      </Box>
      <Pressable
        onPress={onCopyPrevious}
        hitSlop={8}
        className={`mt-2 h-9 flex-row items-center gap-1.5 self-end rounded-none border bg-background-100 px-3 active:bg-background-200`}
        style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
        accessibilityRole="button"
        accessibilityLabel="Copy previous day's meals"
      >
        <Feather name="copy" size={12} color={colors.text} />
        <Text size="2xs" bold className="font-mono uppercase tracking-widest text-typography-900">
          Copy previous day
        </Text>
      </Pressable>
    </Box>
  )

  const summaryCard = (
    <Card
      variant="elevated"
      className="mb-3 overflow-hidden border p-0"
      style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
    >
      <Box className="items-center pt-4">
        <CalorieRing
          consumed={totals.kcal}
          goal={settings.calorie_goal}
          protein={totals.protein}
          carbs={totals.carbs}
          fat={totals.fat}
          size={isWide ? 150 : width < 380 ? 118 : 136}
        />
      </Box>
      <Box className="px-4 pb-3 pt-1">
        <MacroBar
          protein={totals.protein}
          carbs={totals.carbs}
          fat={totals.fat}
          proteinGoal={settings.protein_goal}
          carbsGoal={settings.carbs_goal}
          fatGoal={settings.fat_goal}
        />
      </Box>
      <Pressable
        onPress={() => void handleShowDayNutrition()}
        className="mx-3 mb-3 flex-row items-center justify-center gap-2 border bg-background-100 py-2.5 active:bg-background-200"
        style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 } as any}
        accessibilityRole="button"
        accessibilityLabel="View Nutrition and Micros, full nutrition and micronutrient breakdown"
      >
        <Feather name="pie-chart" size={12} color={colors.primary} />
        <Text
          size="2xs"
          bold
          className="font-mono uppercase tracking-widest"
          style={{ color: colors.primary, letterSpacing: 0.06 }}
        >
          View Nutrition and Micros
        </Text>
      </Pressable>
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
    <Box className={`mb-4 flex-row ${compact ? "gap-2" : "gap-2.5"}`}>
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
          className={`items-center justify-center rounded-none border bg-primary-500 active:bg-primary-600 ${compact ? "min-w-[52px] px-2" : "min-w-[56px] px-3"}`}
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
        className={`min-w-0 flex-1 flex-row items-center rounded-none border bg-background-50 active:bg-background-100 ${compact ? "gap-2 p-2" : "gap-2.5 p-2.5"}`}
        style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 0 }}
        accessibilityRole="button"
        accessibilityLabel={`Log weight, ${
          displayedWeight != null ? `${formatWeight(displayedWeight, settings.units)} weight` : ""
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
          <Feather name="activity" size={compact ? 16 : 18} color={colors.primary} />
        </Box>
        <Box className="min-w-0 flex-1">
          <Text size="sm" bold numberOfLines={1} className="font-tabular text-typography-900">
            {displayedWeight != null
              ? `${formatWeight(displayedWeight, settings.units)} `
              : "Not set"}
          </Text>
          <Text
            size="2xs"
            numberOfLines={1}
            className="font-mono uppercase tracking-widest text-typography-500"
          >
            {displayedWeight != null ? "Weight · tap to log" : "Log weight"}
          </Text>
        </Box>
      </Pressable>
    </Box>
  )

  const nutritionHeader = (
    <Box className="mb-3 flex-row items-center justify-between px-1">
      <Text size="xl" bold style={{ color: colors.textOnBackground }}>
        MEALS
      </Text>
      {isWide ? (
        <Pressable
          onPress={() => setLogSlotOpen(true)}
          className="bg-primary flex-row items-center gap-1.5 rounded-none border px-3.5 py-1.5 active:opacity-80"
          style={{ borderWidth: 1.5, borderColor: colors.primary, borderRadius: 0 }}
          accessibilityRole="button"
          accessibilityLabel="Log food"
        >
          <Feather name="plus" size={16} color={colors.onPrimary} />
          <Text size="sm" bold style={{ color: colors.onPrimary }}>
            LOG FOOD
          </Text>
        </Pressable>
      ) : null}
    </Box>
  )

  return (
    <Box className="flex-1 bg-background-0">
      <OfflineBanner visible={!yazioAvailable} />
      <PageContainer variant={isWide ? "wide" : "narrow"} className="flex-1">
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerClassName={`p-4 w-full ${isWide ? "self-stretch max-w-none px-6 pb-16" : "self-center pb-48"}`}
          style={{ paddingTop: insets.top + spacing.xs }}
        >
          {isInitialLoading ? (
            <View
              style={{
                flex: 1,
                minHeight: 320,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 48,
              }}
            >
              <LoadingSpinner size={32} />
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
              {renderMealSections()}
            </>
          )}
        </ScrollView>
      </PageContainer>

      <NutritionBreakdownModal
        visible={nutritionModal.visible}
        onClose={() => setNutritionModal((s) => ({ ...s, visible: false }))}
        nutrients={nutritionModal.nutrients}
        title={nutritionModal.title}
        subtitle={nutritionModal.subtitle}
      />

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
          // The cluster anchors above the tab bar, so this is pure clearance.
          bottomOffset={isWide ? 32 : 14}
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
