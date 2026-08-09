import { useCallback, useMemo, useState } from "react"
import { Pressable, RefreshControl, ScrollView, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CalorieRing } from "@/components/CalorieRing"
import { MacroBar } from "@/components/MacroBar"
import { MealSection } from "@/components/MealSection"
import { OfflineBanner } from "@/components/OfflineBanner"
import { PageContainer } from "@/components/PageContainer"
import { DatePickerModal } from "@/components/DatePickerModal"
import { Fab } from "@/components/Fab"
import { useApp } from "@/context/AppContext"
import { importDiaryFromYazio, type MealGoals, type YazioDailySummary } from "@/services/yazio/sync"
import { pullAgentChanges } from "@/services/agent-bridge"
import { useToast } from "@/context/ToastContext"
import type { DiaryEntry, MealType } from "@/types"
import { deleteFoodEntry, getDiaryEntriesForDate } from "@/services/diary"
import { confirmAction } from "@/utils/confirm"
import { shiftDateKey, toDateKey, formatDisplayDate } from "@/utils/date"
import { formatWaterAmount, formatWeight } from "@/utils/units"
import { MEAL_TYPES } from "@/utils/meals"
import { useLayout } from "@/hooks/useLayout"
import { useTheme } from "@/hooks/useTheme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Card } from "@ui/card"

type Totals = { kcal: number; protein: number; carbs: number; fat: number }

function sumEntries(list: DiaryEntry[]): Totals {
  return list.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export default function TodayScreen() {
  const router = useRouter()
  const { settings, yazioAvailable, authenticated } = useApp()
  const { showError, showSuccess, showWarning } = useToast()
  const { colors } = useTheme()
  const { isWide } = useLayout()
  const [dateKey, setDateKey] = useState(toDateKey())
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [mealGoals, setMealGoals] = useState<MealGoals>({})
  const [summary, setSummary] = useState<YazioDailySummary | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const totals = useMemo(() => sumEntries(entries), [entries])

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
    async (options?: { quiet?: boolean }) => {
      // 0. Agent bridge (web only): apply any changes external AI agents made
      //    through the /mcp endpoint before rendering the diary.
      await pullAgentChanges().catch(() => undefined)

      // 1. Local first — the diary renders from SQLite before any network is touched.
      let list: DiaryEntry[]
      try {
        list = await getDiaryEntriesForDate(dateKey)
        setEntries(list)
      } catch (error) {
        showError(error, "Could not load diary for this day.")
        return
      }

      // 2. Background sync — imports and goals refresh without blocking the render.
      if (!authenticated) return
      setImporting(true)
      try {
        const result = await importDiaryFromYazio(dateKey)
        setMealGoals(result.mealGoals)
        setSummary(result.summary)
        if (result.imported > 0 || result.failed > 0 || result.error) {
          const updated = await getDiaryEntriesForDate(dateKey)
          setEntries(updated)
        }
        if (result.error && !options?.quiet) {
          showWarning(result.error, "YAZIO import")
        } else if (!options?.quiet && result.imported > 0 && result.failed === 0) {
          showSuccess(
            result.imported === 1
              ? "Imported 1 item from YAZIO."
              : `Imported ${result.imported} items from YAZIO.`,
            "Synced",
          )
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
    [authenticated, dateKey, showError, showSuccess, showWarning],
  )

  useFocusEffect(
    useCallback(() => {
      load({ quiet: true })
    }, [load]),
  )

  const shiftDate = (delta: number) => {
    setDateKey((current) => shiftDateKey(current, delta))
  }

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
    await load()
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
          } catch (error) {
            showError(error, "Could not delete entry.")
          }
        },
      })
    },
    [entries, load, showError],
  )

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

  const isToday = dateKey === toDateKey()
  const weight = summary?.weight
  const insets = useSafeAreaInsets()

  const fabCluster =
    settings.ai_enabled === 1 ? (
      <View
        style={{
          position: "absolute",
          right: 20,
          bottom: isWide ? insets.bottom + 24 : 64 + insets.bottom + 16,
        }}
        pointerEvents="box-none"
      >
        <Fab
          icon="robot-outline"
          IconComponent={MaterialCommunityIcons}
          label="Ask AI"
          onPress={() => router.push("/ai-chat")}
          accessibilityLabel="Open AI assistant"
        />
      </View>
    ) : null

  const summaryCard = (
    <Card variant="elevated" className="mb-6 overflow-hidden">
      <CalorieRing
        consumed={totals.kcal}
        goal={settings.calorie_goal}
        burned={summary?.activityEnergy ?? 0}
        size={isWide ? 170 : 140}
      />
      <MacroBar
        protein={totals.protein}
        carbs={totals.carbs}
        fat={totals.fat}
        proteinGoal={settings.protein_goal}
        carbsGoal={settings.carbs_goal}
        fatGoal={settings.fat_goal}
      />
      {summary && (summary.steps > 0 || summary.waterIntake > 0 || weight) ? (
        <Box className="flex-row items-center justify-around border-t border-outline-200 px-2 py-3">
          {summary.steps > 0 ? (
            <Box className="flex-row items-center gap-1.5">
              <Ionicons name="footsteps-outline" size={16} color={colors.primary} />
              <Text size="sm" className="text-typography-900">
                {summary.steps.toLocaleString()}
              </Text>
            </Box>
          ) : null}
          {summary.waterIntake > 0 ? (
            <Box className="flex-row items-center gap-1.5">
              <Ionicons name="water-outline" size={16} color={colors.primary} />
              <Text size="sm" className="text-typography-900">
                {summary.waterGoal > 0
                  ? `${formatWaterAmount(summary.waterIntake, settings.units)} / ${formatWaterAmount(summary.waterGoal, settings.units)}`
                  : formatWaterAmount(summary.waterIntake, settings.units)}
              </Text>
            </Box>
          ) : null}
          {weight ? (
            <Box className="flex-row items-center gap-1.5">
              <Ionicons name="scale-outline" size={16} color={colors.primary} />
              <Text size="sm" className="text-typography-900">
                {formatWeight(weight, settings.units)}
              </Text>
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Card>
  )

  const nutritionHeader = (
    <Box className="mb-4 flex-row items-center justify-between px-1">
      <Text size="2xl" bold style={{ color: colors.textOnBackground }}>
        Meals
      </Text>
    </Box>
  )

  return (
    <Box className="flex-1 bg-background-0">
      <OfflineBanner visible={!yazioAvailable} />
      <PageContainer variant={isWide ? "wide" : "narrow"} className="flex-1">
        <Box className="px-6 pb-2 pt-3">
          <Card variant="elevated" className="flex-row items-center px-2 py-2">
            <Pressable
              onPress={() => shiftDate(-1)}
              hitSlop={12}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-background-100"
              accessibilityRole="button"
              accessibilityLabel="Previous day"
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Pressable
              className="flex-1 items-center py-0.5"
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open calendar"
            >
              <Text size="md" bold className="text-typography-900">
                {formatDisplayDate(dateKey)}
              </Text>
              {!isToday ? (
                <Box className="mt-1 rounded-full bg-primary-500/15 px-3 py-0.5">
                  <Text size="2xs" bold className="text-primary-700">
                    Jump to today
                  </Text>
                </Box>
              ) : null}
            </Pressable>
            <Box className="flex-row items-center">
              <Pressable
                onPress={() => shiftDate(1)}
                hitSlop={12}
                className="h-10 w-10 items-center justify-center rounded-full active:bg-background-100"
                accessibilityRole="button"
                accessibilityLabel="Next day"
              >
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </Pressable>
              {authenticated ? (
                <Pressable
                  onPress={() => load()}
                  disabled={importing || refreshing}
                  className="h-10 w-10 items-center justify-center rounded-full active:bg-background-100"
                  accessibilityRole="button"
                  accessibilityLabel="Refresh from YAZIO"
                >
                  <Ionicons
                    name="cloud-download-outline"
                    size={20}
                    color={importing ? colors.textMuted : colors.primary}
                  />
                </Pressable>
              ) : (
                <Box className="w-10" />
              )}
            </Box>
          </Card>
        </Box>

        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerClassName={`p-4 w-full ${isWide ? "self-stretch max-w-none px-6 pb-16" : "self-center pb-44"}`}
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

      <DatePickerModal
        visible={pickerOpen}
        dateKey={dateKey}
        onSelect={(key) => setDateKey(key)}
        onClose={() => setPickerOpen(false)}
      />

      {fabCluster}
    </Box>
  )
}
