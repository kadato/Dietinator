import { useCallback, useMemo, useState } from "react"
import { Pressable, RefreshControl, ScrollView, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
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
import { spacing } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Card } from "@ui/card"

export default function TodayScreen() {
  const router = useRouter()
  const { settings, yazioAvailable, authenticated } = useApp()
  const { showError, showWarning, showUndo } = useToast()
  const { colors } = useTheme()
  const { isWide } = useLayout()
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
        title: "Daily Nutrition & Micros",
        subtitle: `${formatDisplayDate(dateKey)} · ${entries.length} foods logged`,
      })
    } catch {
      setNutritionModal({
        visible: true,
        nutrients: totals,
        title: "Daily Nutrition & Micros",
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
      //    through the /mcp endpoint before rendering the diary.
      await pullAgentChanges().catch(() => undefined)

      // 1. Local first — the diary renders from SQLite before any network is
      //    touched. Stale nutrient values are refined in the background below.
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
      }

      // 2. Background — refine stale nutrients, then import. Never blocks the
      //    render; the import is throttled so tab switches don't re-hit YAZIO.
      if (!authenticated) return
      setImporting(true)
      try {
        const refreshed = await getDiaryEntriesForDate(dateKey)
        setEntries(refreshed)
        const result = await importDiaryFromYazio(dateKey, { force: options?.force })
        setMealGoals(result.mealGoals)
        setSummary(result.summary)
        // Imports wrote to SQLite — a final local read (no network) is the
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
      await addWaterEntry({ date: dateKey, amountMl: amount })
      await load({ quiet: true })
    } catch (error) {
      showError(error, "Could not log water.")
    }
  }

  const summaryCard = (
    <Card variant="elevated" className="mb-5 overflow-hidden rounded-3xl p-0">
      {/* Integrated Header: Date Navigation, Sync Status, and Copy Action */}
      <Box className="border-b border-outline-100 bg-background-50/60 p-3">
        <Box className="flex-row items-center justify-between">
          {/* Date Selector: Previous Day, Interactive Date (Opens Calendar Modal), Next Day */}
          <Box className="flex-row items-center gap-1">
            <Pressable
              onPress={() => setDateKey((d) => shiftDateKey(d, -1))}
              hitSlop={8}
              className="h-8 w-8 items-center justify-center rounded-full bg-background-100 active:bg-background-200"
              accessibilityRole="button"
              accessibilityLabel="Previous day"
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>

            <Pressable
              onPress={() => setPickerOpen(true)}
              hitSlop={6}
              className="flex-row items-center gap-1.5 rounded-full bg-background-100 px-3 py-1.5 active:bg-background-200"
              accessibilityRole="button"
              accessibilityLabel={`Selected date: ${formatHeaderDate(dateKey)}. Tap to open calendar.`}
            >
              <Ionicons name="calendar-outline" size={15} color={colors.primary} />
              <Text size="sm" bold className="text-typography-900">
                {formatHeaderDate(dateKey)}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setDateKey((d) => shiftDateKey(d, 1))}
              hitSlop={8}
              className="h-8 w-8 items-center justify-center rounded-full bg-background-100 active:bg-background-200"
              accessibilityRole="button"
              accessibilityLabel="Next day"
            >
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </Pressable>
          </Box>

          {/* Streak & Sync status */}
          <Box className="flex-row items-center gap-1.5">
            <Box
              className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
              style={{ backgroundColor: `${colors.lunch}18` }}
              accessibilityRole="text"
              accessibilityLabel={`${streak} day logging streak`}
            >
              <Ionicons name="flame" size={15} color={colors.lunch} />
              <Text
                size="xs"
                bold
                className="font-tabular leading-none"
                style={{ color: colors.lunch }}
              >
                {streak}
              </Text>
            </Box>

            {authenticated ? (
              <Pressable
                onPress={() => load({ force: true })}
                disabled={importing || refreshing}
                hitSlop={8}
                className="h-8 w-8 items-center justify-center rounded-full bg-background-100 active:bg-background-200"
                accessibilityRole="button"
                accessibilityLabel="Refresh from YAZIO"
              >
                <Ionicons
                  name="cloud-download-outline"
                  size={18}
                  color={importing ? colors.textMuted : colors.primary}
                />
              </Pressable>
            ) : null}
          </Box>
        </Box>

        {/* Copy Action: Duplicate previous day's logged meals */}
        <Pressable
          onPress={onCopyPrevious}
          hitSlop={6}
          className="mt-2.5 flex-row items-center justify-center gap-1.5 rounded-2xl bg-primary-500/10 px-3 py-2 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Copy previous day's meals"
        >
          <Ionicons name="copy-outline" size={14} color={colors.primary} />
          <Text size="xs" bold className="leading-none" style={{ color: colors.primary }}>
            Copy previous day
          </Text>
        </Pressable>
      </Box>

      <Box className="items-center pt-3">
        <CalorieRing
          consumed={totals.kcal}
          goal={settings.calorie_goal}
          protein={totals.protein}
          carbs={totals.carbs}
          fat={totals.fat}
          size={isWide ? 150 : 136}
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
      <Pressable
        onPress={() => void handleShowDayNutrition()}
        className="mx-3 mb-2 flex-row items-center justify-center gap-2 rounded-2xl bg-background-100 py-2.5 active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel="View full nutrition and micronutrients breakdown"
      >
        <Ionicons name="pie-chart-outline" size={15} color={colors.primary} />
        <Text size="xs" bold style={{ color: colors.primary }}>
          View Nutrition & Micros
        </Text>
      </Pressable>
      <Box className="flex-row items-center gap-2.5 border-t border-outline-100 p-3">
        <Box className="min-w-0 flex-1 flex-row items-center rounded-2xl bg-primary-500/10 p-2.5">
          <Pressable
            onPress={() => setLogWaterOpen(true)}
            className="min-w-0 flex-1 flex-row items-center gap-2 active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="Log water"
          >
            <Box className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500/15">
              <Ionicons name="water-outline" size={18} color={colors.primary} />
            </Box>
            <Box className="min-w-0 flex-1">
              <Text size="sm" bold numberOfLines={1} className="font-tabular text-typography-900">
                {formatWaterAmount(waterIntake, settings.units)}
              </Text>
              <Text size="2xs" className="font-tabular text-typography-500">
                {waterGoal > 0 ? `/ ${formatWaterAmount(waterGoal, settings.units)}` : "Water"}
              </Text>
            </Box>
          </Pressable>
          <Pressable
            onPress={() => void handleQuickWater(250)}
            hitSlop={4}
            className="h-8 items-center justify-center rounded-full bg-primary-500 px-2.5 active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="Quick add 250ml water"
          >
            <Text size="2xs" bold className="font-tabular" style={{ color: colors.onPrimary }}>
              +250ml
            </Text>
          </Pressable>
        </Box>

        <Pressable
          onPress={() => setLogWeightOpen(true)}
          className="min-w-0 flex-1 flex-row items-center gap-2.5 rounded-2xl bg-primary-500/10 p-2.5 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Log weight"
        >
          <Box className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500/15">
            <Ionicons name="scale-outline" size={18} color={colors.primary} />
          </Box>
          <Box className="min-w-0 flex-1">
            <Text size="sm" bold numberOfLines={1} className="font-tabular text-typography-900">
              {displayedWeight != null ? formatWeight(displayedWeight, settings.units) : "—"}
            </Text>
            <Text size="2xs" className="text-typography-500">
              {displayedWeight != null ? "Weight" : "Log weight"}
            </Text>
          </Box>
        </Pressable>
      </Box>
      {summary && summary.steps > 0 ? (
        <Box className="flex-row items-center justify-center gap-1.5 border-t border-outline-100 pb-3 pt-2">
          <Ionicons name="footsteps-outline" size={15} color={colors.primary} />
          <Text size="xs" className="font-tabular text-typography-900">
            {summary.steps.toLocaleString()} steps
          </Text>
        </Box>
      ) : null}
    </Card>
  )

  const nutritionHeader = (
    <Box className="mb-3 flex-row items-center justify-between px-1">
      <Text size="xl" bold style={{ color: colors.textOnBackground }}>
        Meals
      </Text>
      <Pressable
        onPress={() => setLogSlotOpen(true)}
        className="flex-row items-center gap-1.5 rounded-full bg-primary-500 px-3.5 py-1.5 active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel="Log food"
      >
        <Ionicons name="add" size={16} color={colors.onPrimary} />
        <Text size="sm" bold style={{ color: colors.onPrimary }}>
          Log food
        </Text>
      </Pressable>
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
          contentContainerClassName={`p-4 w-full ${isWide ? "self-stretch max-w-none px-6 pb-16" : "self-center pb-36"}`}
          style={{ paddingTop: insets.top + spacing.xs }}
        >
          {isWide ? (
            <Box className="w-full flex-row items-start gap-6">
              <Box className="min-w-[340px] max-w-[460px] flex-[0.95]">{summaryCard}</Box>
              <Box className="min-w-0 flex-[1.05]">
                {nutritionHeader}
                <Box className="flex-row flex-wrap gap-2">{renderMealSections(true)}</Box>
              </Box>
            </Box>
          ) : (
            <>
              {summaryCard}
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
        onSelect={(slot, targetDate) => {
          setLogSlotOpen(false)
          router.push({
            pathname: "/log-meal",
            params: { meal: slot, date: targetDate },
          })
        }}
        onClose={() => setLogSlotOpen(false)}
      />

      <FabCluster
        bottomOffset={24}
        right={
          <Fab
            icon="add"
            onPress={() => setLogSlotOpen(true)}
            accessibilityLabel="Log food into diary"
          />
        }
      />
    </Box>
  )
}
