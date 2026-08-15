import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, ScrollView, View } from "react-native"
import { useFocusEffect } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { PageContainer } from "@/components/PageContainer"
import { SegmentedControl } from "@/components/SegmentedControl"
import { EmptyState } from "@/components/EmptyState"
import { TrendChart, type TrendPoint } from "@/components/TrendChart"
import { LogWeightModal } from "@/components/LogWeightModal"
import { useApp } from "@/context/AppContext"
import { useToast } from "@/context/ToastContext"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import {
  getWeightEntries,
  getLatestWeightEntry,
  getRecentWeightEntries,
  deleteWeightEntry,
  saveWeightEntry,
} from "@/db/weight"
import {
  getCalorieHistory,
  getMacroHistory,
  getWaterHistory,
  type DailyKcal,
  type DailyMacros,
  type DailyWater,
} from "@/db/stats"
import { shiftDateKey, toDateKey, formatDisplayDate } from "@/utils/date"
import { formatWeight, formatWaterAmount } from "@/utils/units"
import { computeAdherence, computeLogStreak } from "@/utils/adherence"
import { confirmAction } from "@/utils/confirm"
import type { WeightEntry } from "@/types"
import { spacing } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Card } from "@ui/card"
import { Button, ButtonText } from "@ui/button"

type RangeId = "1w" | "1m" | "3m" | "6m" | "1y"
type MacroMetric = "protein" | "carbs" | "fat"

const RANGES: { id: RangeId; label: string; days: number }[] = [
  { id: "1w", label: "1W", days: 7 },
  { id: "1m", label: "1M", days: 30 },
  { id: "3m", label: "3M", days: 90 },
  { id: "6m", label: "6M", days: 180 },
  { id: "1y", label: "1Y", days: 365 },
]

const MACRO_METRICS: { value: MacroMetric; label: string }[] = [
  { value: "protein", label: "Protein" },
  { value: "carbs", label: "Carbs" },
  { value: "fat", label: "Fat" },
]

/** Shared chart height so all four trend cards stay aligned. */
const CHART_HEIGHT = 170

function formatAxisDate(dateKey: string, range: RangeId): string {
  const [y, m, d] = dateKey.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return ""
  if (range === "1y") {
    return date.toLocaleDateString(undefined, { month: "short" })
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export default function StatsScreen() {
  const { settings } = useApp()
  const { showError, showUndo } = useToast()
  const { colors } = useTheme()
  const { isWide } = useLayout()
  const insets = useSafeAreaInsets()
  const [range, setRange] = useState<RangeId>("1m")
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([])
  const [latest, setLatest] = useState<WeightEntry | null>(null)
  const [previous, setPrevious] = useState<WeightEntry | null>(null)
  const [calories, setCalories] = useState<DailyKcal[]>([])
  const [macros, setMacros] = useState<DailyMacros[]>([])
  const [water, setWater] = useState<DailyWater[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [logWeightOpen, setLogWeightOpen] = useState(false)
  const [editWeightDate, setEditWeightDate] = useState<string | null>(null)
  const [selectedWeight, setSelectedWeight] = useState<WeightEntry | null>(null)
  const [selectedKcal, setSelectedKcal] = useState<TrendPoint | null>(null)
  const [selectedMacro, setSelectedMacro] = useState<TrendPoint | null>(null)
  const [selectedWater, setSelectedWater] = useState<TrendPoint | null>(null)
  const [macroMetric, setMacroMetric] = useState<MacroMetric>("protein")

  const fromKey = useMemo(
    () => shiftDateKey(toDateKey(), -RANGES.find((r) => r.id === range)!.days),
    [range],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [chartWeights, latestWeight, recentTwo, kcalHistory, macroHistory, waterHistory] =
        await Promise.all([
          getWeightEntries(fromKey),
          getLatestWeightEntry(),
          getRecentWeightEntries(2),
          getCalorieHistory(fromKey),
          getMacroHistory(fromKey),
          getWaterHistory(fromKey),
        ])
      setWeightEntries(chartWeights)
      setLatest(latestWeight)
      setPrevious(recentTwo[1] ?? null)
      setCalories(kcalHistory)
      setMacros(macroHistory)
      setWater(waterHistory)
      setLoadError(false)
    } catch (error) {
      showError(error, "Could not load stats.")
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [fromKey, showError])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const closeLogWeight = useCallback(() => {
    setLogWeightOpen(false)
    setEditWeightDate(null)
    void load()
  }, [load])

  const openLogWeight = useCallback(() => {
    setEditWeightDate(null)
    setLogWeightOpen(true)
  }, [])

  const onDeleteWeight = useCallback(
    (entry: WeightEntry) => {
      confirmAction({
        title: "Delete weight?",
        message: `Remove ${formatWeight(entry.weight_kg, settings.units)} from ${formatDisplayDate(entry.date)}?`,
        confirmLabel: "Delete",
        onConfirm: async () => {
          try {
            await deleteWeightEntry(entry.id)
            setSelectedWeight(null)
            await load()
            showUndo("Weight entry removed.", () => {
              saveWeightEntry({
                date: entry.date,
                weightKg: entry.weight_kg,
                note: entry.note ?? undefined,
              })
                .then(() => load())
                .catch(() => undefined)
            })
          } catch (error) {
            showError(error, "Could not delete weight entry.")
          }
        },
      })
    },
    [load, settings.units, showError, showUndo],
  )

  const onDeleteLatest = useCallback(() => {
    if (latest) onDeleteWeight(latest)
  }, [latest, onDeleteWeight])

  const onWeightPointPress = useCallback(
    (point: TrendPoint) => {
      const entry = weightEntries.find((item) => item.date === point.date) ?? null
      setSelectedWeight(entry)
    },
    [weightEntries],
  )

  const weightChartData = useMemo(
    () => weightEntries.map((entry) => ({ date: entry.date, value: entry.weight_kg })),
    [weightEntries],
  )
  const calorieChartData = useMemo(
    () => calories.map((day) => ({ date: day.date, value: day.kcal })),
    [calories],
  )
  const macroChartData = useMemo(
    () => macros.map((day) => ({ date: day.date, value: day[macroMetric] })),
    [macroMetric, macros],
  )
  const waterChartData = useMemo(
    () => water.map((day) => ({ date: day.date, value: day.ml })),
    [water],
  )

  const rawDelta = latest && previous ? latest.weight_kg - previous.weight_kg : null
  // Float subtraction (75.5 − 74.8) can produce 0.7000000000000028 — round to
  // the display precision before formatting.
  const weightDelta = rawDelta !== null ? Math.round(rawDelta * 10) / 10 : null

  const avgKcal =
    calorieChartData.length > 0
      ? Math.round(
          calorieChartData.reduce((sum, day) => sum + day.value, 0) / calorieChartData.length,
        )
      : null

  const macroGoal = settings[`${macroMetric}_goal`]
  const macroColor =
    macroMetric === "protein"
      ? colors.breakfast
      : macroMetric === "carbs"
        ? colors.lunch
        : colors.dinner

  const adherence = useMemo(
    () => computeAdherence(calories, settings.calorie_goal),
    [calories, settings.calorie_goal],
  )
  const logStreak = useMemo(() => computeLogStreak(calories), [calories])

  const avgMacros = useMemo(() => {
    if (macros.length === 0) return null
    const count = macros.length
    const protein = Math.round(macros.reduce((s, m) => s + m.protein, 0) / count)
    const carbs = Math.round(macros.reduce((s, m) => s + m.carbs, 0) / count)
    const fat = Math.round(macros.reduce((s, m) => s + m.fat, 0) / count)
    const totalKcal = protein * 4 + carbs * 4 + fat * 9
    return {
      protein,
      carbs,
      fat,
      proteinPct: totalKcal > 0 ? Math.round(((protein * 4) / totalKcal) * 100) : 0,
      carbsPct: totalKcal > 0 ? Math.round(((carbs * 4) / totalKcal) * 100) : 0,
      fatPct: totalKcal > 0 ? Math.round(((fat * 9) / totalKcal) * 100) : 0,
    }
  }, [macros])

  // Body metrics — BMI needs a height, goal progress needs a target weight.
  const heightCm = settings.height_cm > 0 ? settings.height_cm : 0
  const targetKg = settings.target_weight_kg > 0 ? settings.target_weight_kg : 0
  const bmi =
    heightCm > 0 && latest ? Math.round((latest.weight_kg / (heightCm / 100) ** 2) * 10) / 10 : null
  const goalDelta = latest && targetKg > 0 ? latest.weight_kg - targetKg : null

  // Progress toward the target weight uses the earliest logged weigh-in in the
  // range as the starting point (there is no stored "start weight").
  const firstWeight = weightEntries.length > 0 ? weightEntries[0].weight_kg : null
  const goalProgress =
    latest && firstWeight !== null && targetKg > 0 && firstWeight !== targetKg
      ? Math.min(Math.max((firstWeight - latest.weight_kg) / (firstWeight - targetKg), 0), 1)
      : null

  const weightEmptyState = (
    <EmptyState
      icon="scale-outline"
      iconColor={colors.primary}
      title={`No weight logged ${range === "1w" ? "this week" : "in this range"} yet.`}
      variant="compact"
      action={
        <Button size="sm" onPress={openLogWeight} accessibilityLabel="Log weight">
          <ButtonText>Log weight</ButtonText>
        </Button>
      }
    />
  )

  const caloriesEmptyState = (
    <EmptyState
      icon="flame-outline"
      iconColor={colors.primary}
      title={`No diary entries ${range === "1w" ? "this week" : "in this range"} yet.`}
      variant="compact"
    />
  )

  return (
    <Box className="flex-1 bg-background-0">
      <PageContainer variant={isWide ? "wide" : "narrow"} className="flex-1">
        <Box className="px-6 pb-2" style={{ paddingTop: insets.top + spacing.md }}>
          <Text size="2xl" bold style={{ color: colors.textOnBackground }}>
            Stats
          </Text>
          <Text size="xs" className="mt-1 text-typography-500">
            Weight, calories and macro trends
          </Text>
        </Box>

        <ScrollView
          contentContainerClassName={`p-4 w-full ${isWide ? "self-stretch max-w-none px-6 pb-16" : "self-center pb-16"}`}
        >
          <SegmentedControl
            value={range}
            options={RANGES.map((r) => ({ value: r.id, label: r.label }))}
            onChange={setRange}
          />

          {loading ? (
            <Box className="items-center justify-center py-20">
              <ActivityIndicator size="large" color={colors.primary} />
            </Box>
          ) : loadError ? (
            <Card variant="elevated" className="mt-4 p-4">
              <Box className="flex-row items-center gap-2.5">
                <Box className="h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10">
                  <Ionicons name="cloud-offline-outline" size={18} color={colors.danger} />
                </Box>
                <Box className="min-w-0 flex-1">
                  <Text size="md" bold className="text-typography-900">
                    Could not load stats
                  </Text>
                  <Text size="xs" className="text-typography-500">
                    Try switching ranges or pull to refresh.
                  </Text>
                </Box>
              </Box>
            </Card>
          ) : (
            <Box className="mt-4 gap-4">
              {/* Consistency */}
              <Card variant="elevated" className="p-4">
                <Box className="flex-row items-center gap-2.5">
                  <Box className="h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10">
                    <Ionicons name="pulse-outline" size={18} color={colors.primary} />
                  </Box>
                  <Box className="min-w-0 flex-1">
                    <Text size="md" bold className="text-typography-900">
                      Consistency
                    </Text>
                    <Text size="xs" className="text-typography-500">
                      Logging streak and calorie adherence
                    </Text>
                  </Box>
                </Box>

                <Box className="mt-3 flex-row gap-3">
                  <Box className="flex-1 items-center rounded-xl border border-outline-100 bg-background-50 py-3">
                    <Box className="flex-row items-center gap-1">
                      <Ionicons name="flame" size={14} color={colors.warning} />
                      <Text size="lg" bold className="text-typography-900">
                        {logStreak}
                      </Text>
                    </Box>
                    <Text size="xs" className="mt-0.5 text-typography-500">
                      Day streak
                    </Text>
                  </Box>
                  <Box className="flex-1 items-center rounded-xl border border-outline-100 bg-background-50 py-3">
                    <Text size="lg" bold className="text-typography-900">
                      {adherence.loggedDays}
                    </Text>
                    <Text size="xs" className="mt-0.5 text-typography-500">
                      Logged days
                    </Text>
                  </Box>
                  <Box className="flex-1 items-center rounded-xl border border-outline-100 bg-background-50 py-3">
                    <Text size="lg" bold className="text-typography-900">
                      {adherence.onTargetPct !== null ? `${adherence.onTargetPct}%` : "—"}
                    </Text>
                    <Text size="xs" className="mt-0.5 text-typography-500">
                      On target
                    </Text>
                  </Box>
                </Box>
              </Card>

              {/* Body weight */}
              <Card variant="elevated" className="p-4">
                <Box className="flex-row items-center gap-2.5">
                  <Box className="h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10">
                    <Ionicons name="scale-outline" size={18} color={colors.primary} />
                  </Box>
                  <Box className="min-w-0 flex-1">
                    <Text size="md" bold className="text-typography-900">
                      Body weight
                    </Text>
                    {latest ? (
                      <Box className="flex-row items-center gap-1.5">
                        <Text size="xs" className="text-typography-500">
                          {formatDisplayDate(latest.date)}
                        </Text>
                        {weightDelta !== null && weightDelta !== 0 ? (
                          <Box className="flex-row items-center gap-0.5">
                            <Ionicons
                              name={weightDelta < 0 ? "arrow-down-outline" : "arrow-up-outline"}
                              size={11}
                              color={weightDelta < 0 ? colors.primary : colors.danger}
                            />
                            <Text
                              size="xs"
                              bold
                              style={{ color: weightDelta < 0 ? colors.primary : colors.danger }}
                            >
                              {formatWeight(Math.abs(weightDelta), settings.units)}
                            </Text>
                          </Box>
                        ) : null}
                      </Box>
                    ) : (
                      <Text size="xs" className="text-typography-500">
                        Not logged yet
                      </Text>
                    )}
                  </Box>
                  <Text size="lg" bold className="text-typography-900">
                    {latest ? formatWeight(latest.weight_kg, settings.units) : "—"}
                  </Text>
                </Box>

                {latest && (bmi !== null || goalDelta !== null) ? (
                  <Box className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
                    {bmi !== null ? (
                      <Box className="flex-row items-center gap-1">
                        <Ionicons name="body-outline" size={13} color={colors.textMuted} />
                        <Text size="xs" bold className="text-typography-600">
                          BMI {bmi}
                        </Text>
                      </Box>
                    ) : null}
                    {goalDelta !== null ? (
                      <Text size="xs" bold className="text-typography-600">
                        {goalDelta <= 0.05
                          ? "At goal weight"
                          : `${formatWeight(Math.abs(goalDelta), settings.units)} to goal`}
                      </Text>
                    ) : null}
                  </Box>
                ) : null}

                {goalProgress !== null ? (
                  <Box className="mt-3">
                    <Box className="mb-1 flex-row items-center justify-between">
                      <Text size="xs" bold className="text-typography-600">
                        {goalProgress >= 1 ? "Goal reached" : "Goal progress"}
                      </Text>
                      {goalProgress < 1 ? (
                        <Text size="xs" bold className="text-typography-600">
                          {Math.round(goalProgress * 100)}%
                        </Text>
                      ) : null}
                    </Box>
                    <View
                      className="h-2 overflow-hidden rounded-full bg-background-100"
                      accessibilityRole="progressbar"
                      accessibilityLabel="Goal progress"
                      accessibilityValue={{
                        min: 0,
                        max: 100,
                        now: Math.round(goalProgress * 100),
                      }}
                    >
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round(goalProgress * 100)}%`,
                          backgroundColor: colors.primary,
                        }}
                      />
                    </View>
                  </Box>
                ) : null}

                <View className="mt-3">
                  {weightChartData.length > 0 ? (
                    <TrendChart
                      data={weightChartData}
                      color={colors.primary}
                      rangeStart={fromKey}
                      rangeEnd={toDateKey()}
                      formatValue={(value) => formatWeight(value, settings.units)}
                      formatDate={(dateKey) => formatAxisDate(dateKey, range)}
                      height={CHART_HEIGHT}
                      onPointPress={onWeightPointPress}
                      accessibilityLabel={`Body weight trend, ${formatWeight(weightChartData[0].value, settings.units)} to ${formatWeight(weightChartData[weightChartData.length - 1].value, settings.units)}`}
                    />
                  ) : (
                    weightEmptyState
                  )}
                </View>

                {selectedWeight ? (
                  <Box className="mt-3 flex-row items-center gap-2 rounded-xl border border-outline-100 bg-background-50 px-3 py-2">
                    <Ionicons name="location-outline" size={15} color={colors.primary} />
                    <Box className="min-w-0 flex-1">
                      <Text size="xs" bold className="text-typography-900">
                        {formatDisplayDate(selectedWeight.date)}
                      </Text>
                      <Text size="xs" className="text-typography-500">
                        {formatWeight(selectedWeight.weight_kg, settings.units)}
                        {selectedWeight.note ? ` · ${selectedWeight.note}` : ""}
                      </Text>
                    </Box>
                    <Button
                      size="sm"
                      variant="outline"
                      action="secondary"
                      className="w-20"
                      onPress={() => {
                        setEditWeightDate(selectedWeight.date)
                        setLogWeightOpen(true)
                      }}
                      accessibilityLabel="Edit selected weight"
                    >
                      <ButtonText>Edit</ButtonText>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      action="negative"
                      className="w-20"
                      onPress={() => onDeleteWeight(selectedWeight)}
                      accessibilityLabel="Delete selected weight"
                    >
                      <ButtonText>Delete</ButtonText>
                    </Button>
                  </Box>
                ) : null}

                {weightChartData.length > 0 ? (
                  <Box className="mt-3 flex-row gap-2">
                    <Button
                      size="sm"
                      className="min-w-[140px] flex-1"
                      onPress={openLogWeight}
                      accessibilityLabel="Log weight"
                    >
                      <ButtonText>Log weight</ButtonText>
                    </Button>
                    {latest ? (
                      <Button
                        size="sm"
                        variant="outline"
                        action="secondary"
                        className="w-20"
                        onPress={onDeleteLatest}
                        accessibilityLabel="Delete latest weight"
                      >
                        <ButtonText>Delete</ButtonText>
                      </Button>
                    ) : null}
                  </Box>
                ) : null}
              </Card>

              {/* Calories */}
              <Card variant="elevated" className="p-4">
                <Box className="flex-row items-center gap-2.5">
                  <Box className="h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10">
                    <Ionicons name="flame-outline" size={18} color={colors.primary} />
                  </Box>
                  <Box className="min-w-0 flex-1">
                    <Text size="md" bold className="text-typography-900">
                      Calories
                    </Text>
                    <Text size="xs" className="text-typography-500">
                      {avgKcal !== null
                        ? `Avg ${avgKcal.toLocaleString()} kcal/day · goal ${Math.round(settings.calorie_goal).toLocaleString()}`
                        : `Goal ${Math.round(settings.calorie_goal).toLocaleString()} kcal/day`}
                    </Text>
                  </Box>
                </Box>

                <View className="mt-3">
                  {calorieChartData.length > 0 ? (
                    <TrendChart
                      data={calorieChartData}
                      color={colors.lunch}
                      goalValue={settings.calorie_goal}
                      variant="bars"
                      rangeStart={fromKey}
                      rangeEnd={toDateKey()}
                      formatValue={(value) => Math.round(value).toLocaleString()}
                      formatDate={(dateKey) => formatAxisDate(dateKey, range)}
                      height={CHART_HEIGHT}
                      onPointPress={setSelectedKcal}
                      accessibilityLabel={`Calories per day, ${calorieChartData.length} days`}
                    />
                  ) : (
                    caloriesEmptyState
                  )}
                </View>

                {selectedKcal ? (
                  <Text size="xs" bold className="mt-2 px-1 text-typography-600">
                    {formatDisplayDate(selectedKcal.date)} —{" "}
                    {Math.round(selectedKcal.value).toLocaleString()} kcal
                    {settings.calorie_goal > 0
                      ? selectedKcal.value > settings.calorie_goal
                        ? " · over goal"
                        : " · under goal"
                      : ""}
                  </Text>
                ) : null}
              </Card>

              {/* Macros */}
              <Card variant="elevated" className="p-4">
                <Box className="flex-row items-center gap-2.5">
                  <Box className="h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10">
                    <Ionicons name="nutrition-outline" size={18} color={colors.primary} />
                  </Box>
                  <Box className="min-w-0 flex-1">
                    <Text size="md" bold className="text-typography-900">
                      Macros
                    </Text>
                    <Text size="xs" className="text-typography-500">
                      Protein, carb and fat trends
                    </Text>
                  </Box>
                </Box>

                <View className="mt-3">
                  <SegmentedControl<MacroMetric>
                    value={macroMetric}
                    options={MACRO_METRICS}
                    onChange={setMacroMetric}
                  />
                </View>

                <View className="mt-3">
                  {macroChartData.length > 0 ? (
                    <TrendChart
                      data={macroChartData}
                      color={macroColor}
                      goalValue={macroGoal}
                      rangeStart={fromKey}
                      rangeEnd={toDateKey()}
                      formatValue={(value) => `${Math.round(value)} g`}
                      formatDate={(dateKey) => formatAxisDate(dateKey, range)}
                      height={CHART_HEIGHT}
                      onPointPress={setSelectedMacro}
                      accessibilityLabel={`${macroMetric} per day, ${macroChartData.length} days`}
                    />
                  ) : (
                    <EmptyState
                      icon="nutrition-outline"
                      iconColor={colors.primary}
                      title={`No macro data logged ${range === "1w" ? "this week" : "in this range"} yet.`}
                      variant="compact"
                    />
                  )}
                </View>

                {selectedMacro ? (
                  <Text size="xs" bold className="mt-2 px-1 text-typography-600">
                    {formatDisplayDate(selectedMacro.date)} —{" "}
                    {Math.round(selectedMacro.value).toLocaleString()} g{" "}
                    {macroGoal > 0
                      ? selectedMacro.value > macroGoal
                        ? "· over goal"
                        : "· under goal"
                      : ""}
                  </Text>
                ) : null}

                {avgMacros ? (
                  <Box className="mt-3 border-t border-outline-100 pt-3">
                    <Text size="xs" bold className="mb-2 text-typography-500">
                      Average Daily Macro Split
                    </Text>
                    <Box className="flex-row items-center gap-2">
                      <Box
                        className="flex-1 items-center rounded-2xl p-2.5"
                        style={{ backgroundColor: `${colors.breakfast}15` }}
                      >
                        <Text size="xs" bold style={{ color: colors.breakfast }}>
                          Protein
                        </Text>
                        <Text size="sm" bold className="text-typography-900">
                          {avgMacros.protein}g
                        </Text>
                        <Text size="2xs" className="text-typography-500">
                          {avgMacros.proteinPct}% kcal
                        </Text>
                      </Box>
                      <Box
                        className="flex-1 items-center rounded-2xl p-2.5"
                        style={{ backgroundColor: `${colors.lunch}15` }}
                      >
                        <Text size="xs" bold style={{ color: colors.lunch }}>
                          Carbs
                        </Text>
                        <Text size="sm" bold className="text-typography-900">
                          {avgMacros.carbs}g
                        </Text>
                        <Text size="2xs" className="text-typography-500">
                          {avgMacros.carbsPct}% kcal
                        </Text>
                      </Box>
                      <Box
                        className="flex-1 items-center rounded-2xl p-2.5"
                        style={{ backgroundColor: `${colors.dinner}15` }}
                      >
                        <Text size="xs" bold style={{ color: colors.dinner }}>
                          Fat
                        </Text>
                        <Text size="sm" bold className="text-typography-900">
                          {avgMacros.fat}g
                        </Text>
                        <Text size="2xs" className="text-typography-500">
                          {avgMacros.fatPct}% kcal
                        </Text>
                      </Box>
                    </Box>
                  </Box>
                ) : null}
              </Card>

              {/* Water */}
              <Card variant="elevated" className="p-4">
                <Box className="flex-row items-center gap-2.5">
                  <Box className="h-9 w-9 items-center justify-center rounded-xl bg-primary-500/10">
                    <Ionicons name="water-outline" size={18} color={colors.primary} />
                  </Box>
                  <Box className="min-w-0 flex-1">
                    <Text size="md" bold className="text-typography-900">
                      Water
                    </Text>
                    <Text size="xs" className="text-typography-500">
                      Daily intake
                      {settings.water_goal_ml > 0
                        ? ` · goal ${formatWaterAmount(settings.water_goal_ml, settings.units)}`
                        : ""}
                    </Text>
                  </Box>
                </Box>

                <View className="mt-3">
                  {waterChartData.length > 0 ? (
                    <TrendChart
                      data={waterChartData}
                      color={colors.primary}
                      goalValue={settings.water_goal_ml > 0 ? settings.water_goal_ml : undefined}
                      variant="bars"
                      rangeStart={fromKey}
                      rangeEnd={toDateKey()}
                      formatValue={(value) => formatWaterAmount(value, settings.units)}
                      formatDate={(dateKey) => formatAxisDate(dateKey, range)}
                      height={CHART_HEIGHT}
                      onPointPress={setSelectedWater}
                      accessibilityLabel={`Water per day, ${waterChartData.length} days`}
                    />
                  ) : (
                    <EmptyState
                      icon="water-outline"
                      iconColor={colors.primary}
                      title={`No water logged ${range === "1w" ? "this week" : "in this range"} yet.`}
                      variant="compact"
                    />
                  )}
                </View>

                {selectedWater ? (
                  <Text size="xs" bold className="mt-2 px-1 text-typography-600">
                    {formatDisplayDate(selectedWater.date)} —{" "}
                    {formatWaterAmount(selectedWater.value, settings.units)}
                    {settings.water_goal_ml > 0
                      ? selectedWater.value > settings.water_goal_ml
                        ? " · over goal"
                        : " · under goal"
                      : ""}
                  </Text>
                ) : null}
              </Card>
            </Box>
          )}
        </ScrollView>
      </PageContainer>

      <LogWeightModal
        visible={logWeightOpen}
        initialDateKey={editWeightDate ?? undefined}
        onClose={closeLogWeight}
        onSaved={closeLogWeight}
      />
    </Box>
  )
}
