import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CalorieRing } from "@/components/CalorieRing"
import { MacroBar } from "@/components/MacroBar"
import { MealSection } from "@/components/MealSection"
import { OfflineBanner } from "@/components/OfflineBanner"
import { PageContainer } from "@/components/PageContainer"
import { DatePickerModal } from "@/components/DatePickerModal"
import { CopyFromDateModal } from "@/components/CopyFromDateModal"
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
  copyDiaryEntries,
  deleteFoodEntry,
  getDiaryEntriesForDate,
  restoreFoodEntry,
  updateDiaryEntry,
} from "@/services/diary"
import { getLatestWeightEntry, getRecentWeightEntries } from "@/db/weight"
import { addWaterEntry, deleteWaterEntry, getWaterTotalForDate } from "@/db/water"
import { getCalorieHistory } from "@/db/stats"
import { computeLogStreak } from "@/utils/adherence"
import { confirmAction } from "@/utils/confirm"
import { shiftDateKey, toDateKey, formatDisplayDate, formatHeaderDate } from "@/utils/date"
import { sumNutrients } from "@/utils/nutrients"
import { formatWaterAmount, formatWeight } from "@/utils/units"
import { formatNumber, formatThousands } from "@/utils/format"
import { MEAL_TYPES } from "@/utils/meals"
import { useLayout } from "@/hooks/useLayout"
import { useTheme } from "@/hooks/useTheme"
import { spacing, layout, fonts, borders, radii } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Card } from "@ui/card"

export default function TodayScreen() {
  const router = useRouter()
  const { settings, yazioAvailable, authenticated } = useApp()
  const { showError, showWarning, showUndo } = useToast()
  const { colors } = useTheme()
  const { isWide, isLarge, width } = useLayout()
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
  const [copyPickerOpen, setCopyPickerOpen] = useState(false)
  const [streak, setStreak] = useState(0)
  const [localWeight, setLocalWeight] = useState<WeightEntry | null>(null)
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([])
  const [logWeightOpen, setLogWeightOpen] = useState(false)
  const [logWaterOpen, setLogWaterOpen] = useState(false)
  const [logSlotOpen, setLogSlotOpen] = useState(false)
  const [localWaterMl, setLocalWaterMl] = useState(0)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [isPending, startTransition] = useTransition()
  // Session cache for the streak computation, see load() below.
  const streakCacheRef = useRef<{ day: string; count: number } | null>(null)

  // Wrap date navigation in a transition so chevron/arrow-key changes stay
  // responsive while SQLite and network catch up in the background.
  const setDateKeyTransition = useCallback((updater: string | ((prev: string) => string)) => {
    startTransition(() => {
      setDateKey(updater as never)
    })
  }, [])

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
      startTransition(() => {
        void load({ quiet: true })
      })
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

  const [showShortcuts, setShowShortcuts] = useState(false)

  // Desktop affordance: left and right arrows page through diary days, the
  // same contract the chevron buttons offer. Web-only, and inert while any
  // modal is up or a text field owns the keyboard.
  useEffect(() => {
    if (Platform.OS !== "web") return
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      if (keyboardVisible) return
      if (pickerOpen || copyPickerOpen || logWeightOpen || logWaterOpen || logSlotOpen) {
        return
      }
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      setDateKeyTransition((d) => shiftDateKey(d, event.key === "ArrowLeft" ? -1 : 1))
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [
    keyboardVisible,
    pickerOpen,
    copyPickerOpen,
    logWeightOpen,
    logWaterOpen,
    logSlotOpen,
    setDateKeyTransition,
  ])

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load({ force: true })
    setRefreshing(false)
  }, [load])

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

  const handleCopyFromPreview = useCallback(
    async (sourceDate: string, selectedIds: Set<string>) => {
      if (sourceDate === dateKey) {
        showWarning("Pick a different day than the current one.", "Same day")
        return
      }
      if (selectedIds.size === 0) {
        showWarning("Select at least one item to copy.", "Nothing selected")
        return
      }
      try {
        const sourceEntries = await getDiaryEntriesForDate(sourceDate, { remote: false })
        const filtered = sourceEntries.filter((e) => selectedIds.has(e.id))
        const count = await copyDiaryEntries(filtered, dateKey)
        if (count === 0) {
          showWarning(`Nothing was logged on ${formatDisplayDate(sourceDate)}.`, "Nothing to copy")
        } else {
          await load({ quiet: true })
        }
      } catch (error) {
        showError(error, "Could not copy entries.")
      }
    },
    [dateKey, load, showError, showWarning],
  )

  const handleInlineUpdate = useCallback(
    async (id: string, amount: number) => {
      const entry = entries.find((e) => e.id === id)
      if (!entry) return
      try {
        await updateDiaryEntry({ id, amount, mealType: entry.meal_type })
        await load({ quiet: true })
      } catch (error) {
        showError(error, "Could not update entry.")
      }
    },
    [entries, load, showError],
  )

  useEffect(() => {
    if (Platform.OS !== "web") return
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (keyboardVisible) return
      if (pickerOpen || copyPickerOpen || logWeightOpen || logWaterOpen || logSlotOpen) {
        if (event.key === "Escape" && showShortcuts) setShowShortcuts(false)
        return
      }
      if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
        event.preventDefault()
        setShowShortcuts((v) => !v)
        return
      }
      if (event.key === "Escape" && showShortcuts) {
        setShowShortcuts(false)
        return
      }
      if (showShortcuts) return
      if (event.key === "n" || event.key === "N") {
        event.preventDefault()
        setLogSlotOpen(true)
      } else if (event.key === "c" || event.key === "C") {
        event.preventDefault()
        setCopyPickerOpen(true)
      } else if (event.key === "r" || event.key === "R") {
        event.preventDefault()
        void onRefresh()
      } else if (event.key === "w" || event.key === "W") {
        event.preventDefault()
        setLogWaterOpen(true)
      } else if (event.key === "e" || event.key === "E") {
        event.preventDefault()
        setLogWeightOpen(true)
      } else if (event.key >= "1" && event.key <= "4") {
        const meal = MEAL_TYPES[Number(event.key) - 1]
        if (meal) {
          event.preventDefault()
          openAdd(meal)
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [
    keyboardVisible,
    pickerOpen,
    copyPickerOpen,
    logWeightOpen,
    logWaterOpen,
    logSlotOpen,
    showShortcuts,
    onRefresh,
    openAdd,
  ])

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
          onUpdateAmount={handleInlineUpdate}
        />
      )
      return grid ? (
        <View key={meal} className="min-w-0">
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
        borderWidth: borders.width,
        borderColor: colors.border,
        borderStyle: "solid",
        borderRadius: radii.none,
        backgroundColor: colors.surface,
      }}
    >
      <View className={`flex-row items-center ${compact ? "gap-1.5" : "gap-2.5"}`}>
        <Box className={`min-w-0 flex-1 flex-row items-center ${compact ? "gap-1.5" : "gap-2.5"}`}>
          <Pressable
            onPress={() => setDateKeyTransition((d) => shiftDateKey(d, -1))}
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
                  borderWidth: borders.width,
                  borderColor: colors.border,
                  borderStyle: "solid",
                  borderRadius: radii.none,
                  backgroundColor: pressed ? `${colors.primary}20` : colors.surfaceAlt,
                  opacity: isPending ? 0.7 : 1,
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
            accessibilityLabel={`${compact ? formatDisplayDate(dateKey) : formatHeaderDate(dateKey)}. Tap to open calendar.`}
          >
            {({ pressed }) => (
              <Box
                className="w-full flex-row items-center justify-center"
                style={{
                  height: compact ? 38 : 42,
                  paddingHorizontal: compact ? 10 : 14,
                  gap: 6,
                  borderWidth: borders.width,
                  borderColor: colors.border,
                  borderStyle: "solid",
                  borderRadius: radii.none,
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
            onPress={() => setDateKeyTransition((d) => shiftDateKey(d, 1))}
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
                  borderWidth: borders.width,
                  borderColor: colors.border,
                  borderStyle: "solid",
                  borderRadius: radii.none,
                  backgroundColor: pressed ? `${colors.primary}20` : colors.surfaceAlt,
                  opacity: isPending ? 0.7 : 1,
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
                borderWidth: borders.width,
                borderColor: colors.warning,
                borderStyle: "solid",
                borderRadius: radii.none,
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
                  borderWidth: borders.width,
                  borderColor: colors.border,
                  borderStyle: "solid",
                  borderRadius: radii.none,
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
        onPress={() => setCopyPickerOpen(true)}
        hitSlop={8}
        className="mt-2.5 w-full"
        accessibilityRole="button"
        accessibilityLabel="Copy from another date"
      >
        {({ pressed }) => (
          <Box
            className="w-full flex-row items-center justify-center"
            style={{
              height: 42,
              paddingHorizontal: 16,
              gap: 8,
              borderWidth: borders.width,
              borderColor: colors.border,
              borderStyle: "solid",
              borderRadius: radii.none,
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
              Copy from date
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
      style={{ borderWidth: borders.width, borderColor: colors.border, borderRadius: radii.none }}
    >
      <Box className="items-center pt-6">
        <CalorieRing
          consumed={totals.kcal}
          goal={settings.calorie_goal}
          protein={totals.protein}
          carbs={totals.carbs}
          fat={totals.fat}
          size={isLarge ? 192 : isWide ? 168 : width < 380 ? 140 : 152}
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
            {formatThousands(summary.steps)} steps
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
        style={{ borderWidth: borders.width, borderColor: colors.border, borderRadius: radii.none }}
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
              borderWidth: borders.width,
              borderColor: colors.border,
              borderRadius: radii.none,
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
            borderWidth: borders.width,
            borderColor: colors.primary,
            borderRadius: radii.none,
          }}
          accessibilityRole="button"
          accessibilityLabel={`Quick add ${settings.units === "imperial" ? `${formatNumber(250 * 0.033814)} fl oz` : "250ml"} water`}
        >
          <Text
            size="2xs"
            bold
            className="font-mono uppercase leading-none tracking-widest"
            style={{ color: colors.onPrimary, letterSpacing: 0.06 }}
          >
            +{settings.units === "imperial" ? formatNumber(250 * 0.033814) : "250"}
          </Text>
          <Text
            size="2xs"
            className="font-mono uppercase leading-none tracking-widest"
            style={{ color: colors.onPrimary, letterSpacing: 0.06 }}
          >
            {settings.units === "imperial" ? "oz" : "ml"}
          </Text>
        </Pressable>
      </Box>
      <Pressable
        onPress={() => setLogWeightOpen(true)}
        className={`min-w-0 flex-1 cursor-pointer rounded-none border bg-background-50 hover:bg-background-100 active:bg-background-100 ${compact ? "gap-2 p-2" : "gap-2.5 p-2.5"}`}
        style={{ borderWidth: borders.width, borderColor: colors.border, borderRadius: radii.none }}
        accessibilityRole="button"
        accessibilityLabel={
          displayedWeight != null
            ? `${formatWeight(displayedWeight, settings.units)} ${weightHistory.length > 1 ? `${weightHistory.length} WEIGH-INS` : weightHistory.length === 1 ? "1 WEIGH-IN" : "TAP TO LOG"}`
            : "TAP TO LOG WEIGHT"
        }
      >
        <View className="w-full flex-row items-center gap-2">
          <Box
            className="shrink-0 items-center justify-center rounded-none"
            style={{
              width: 44,
              height: 44,
              borderWidth: borders.width,
              borderColor: colors.border,
              borderRadius: radii.none,
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
              style={{ fontSize: 11, letterSpacing: 0.06 }}
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
                      borderWidth: borders.widthThin,
                      borderColor: isLast ? colors.primary : `${colors.primary}40`,
                      borderRadius: radii.none,
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
    <Box className="flex-1" style={{ backgroundColor: "transparent" }}>
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
          contentContainerClassName={`w-full ${isWide ? (isLarge ? "p-6 pb-24" : "p-5 pb-20") : width < layout.breakpointMedium ? "max-w-[720px] self-center p-2 pb-24" : "max-w-[720px] self-center p-2 pb-56"}`}
          style={{
            paddingTop:
              (insets.top > 0 ? insets.top : Platform.OS === "android" ? 24 : 0) + spacing.xs,
          }}
        >
          {isWide ? (
            <Box className={`w-full flex-row items-start ${isLarge ? "gap-6" : "gap-5"}`}>
              <Box
                className={`${isLarge ? "w-[400px]" : "w-[380px]"} shrink-0 gap-4`}
                style={
                  isWide && Platform.OS === "web"
                    ? ({ position: "sticky", top: 0, alignSelf: "flex-start" } as never)
                    : undefined
                }
              >
                {dateChrome}
                {summaryCard}
                {hydrationRow}
                {isLarge ? (
                  <Box
                    className="hidden rounded-none border bg-background-50 p-3 lg:flex"
                    style={{
                      borderWidth: borders.width,
                      borderColor: colors.border,
                      borderRadius: radii.none,
                    }}
                  >
                    <Text
                      size="2xs"
                      bold
                      className="font-mono uppercase tracking-widest text-typography-500"
                      style={{ fontFamily: fonts.mono, letterSpacing: 0.08 }}
                    >
                      Daily rhythm
                    </Text>
                    <Box className="mt-2.5 flex-row gap-2">
                      <Box
                        className="flex-1 items-center rounded-none border bg-background-0 px-1 py-2.5"
                        style={{ borderWidth: borders.widthThin, borderColor: colors.border }}
                      >
                        <Text
                          size="lg"
                          bold
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          className="font-tabular text-typography-900"
                        >
                          {formatThousands(Math.round(totals.kcal))}
                        </Text>
                        <Text
                          size="2xs"
                          numberOfLines={1}
                          className="font-mono uppercase tracking-widest text-typography-500"
                        >
                          kcal logged
                        </Text>
                      </Box>
                      <Box
                        className="flex-1 items-center rounded-none border bg-background-0 px-1 py-2.5"
                        style={{ borderWidth: borders.widthThin, borderColor: colors.border }}
                      >
                        <Text
                          size="lg"
                          bold
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          className="font-tabular"
                          style={{
                            color:
                              totals.kcal > settings.calorie_goal && settings.calorie_goal > 0
                                ? colors.danger
                                : colors.primary,
                          }}
                        >
                          {settings.calorie_goal > 0
                            ? formatThousands(Math.max(settings.calorie_goal - totals.kcal, 0))
                            : "-"}
                        </Text>
                        <Text
                          size="2xs"
                          numberOfLines={1}
                          className="font-mono uppercase tracking-widest text-typography-500"
                        >
                          kcal left
                        </Text>
                      </Box>
                    </Box>
                  </Box>
                ) : null}
              </Box>
              <Box className="min-w-0 flex-1">
                {nutritionHeader}
                {entries.length === 0 && !isInitialLoading ? (
                  <Box
                    className="mb-3 gap-2 border px-4 py-3"
                    style={{
                      borderWidth: borders.width,
                      borderColor: colors.primary,
                      backgroundColor: `${colors.primary}10`,
                      borderRadius: radii.none,
                    }}
                  >
                    <Box className="flex-row items-center gap-2">
                      <Feather name="arrow-up" size={14} color={colors.primary} />
                      <Text
                        size="xs"
                        bold
                        style={{ fontFamily: fonts.mono, color: colors.text, letterSpacing: 0.04 }}
                      >
                        Your diary is empty. Tap Log food or a + on Breakfast to start
                      </Text>
                    </Box>
                    <Pressable
                      onPress={() => setLogSlotOpen(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Log food to start diary"
                      className="mt-1 flex-row items-center justify-center gap-1.5 self-start px-4 active:opacity-80"
                      style={{
                        backgroundColor: colors.primary,
                        borderWidth: borders.width,
                        borderColor: colors.primary,
                        borderRadius: radii.none,
                        paddingVertical: 8,
                      }}
                    >
                      <Feather name="plus" size={14} color={colors.onPrimary} />
                      <Text
                        size="xs"
                        bold
                        style={{
                          color: colors.onPrimary,
                          fontFamily: fonts.mono,
                          textTransform: "uppercase",
                          letterSpacing: 0.06,
                        }}
                      >
                        Log food
                      </Text>
                    </Pressable>
                  </Box>
                ) : null}
                <Box
                  className={isLarge ? "gap-4" : "gap-3.5"}
                  style={
                    Platform.OS === "web"
                      ? ({
                          display: "grid",
                          gridTemplateColumns: isLarge
                            ? "repeat(auto-fit, minmax(340px, 1fr))"
                            : "repeat(auto-fit, minmax(320px, 1fr))",
                          gap: isLarge ? 16 : 14,
                        } as never)
                      : undefined
                  }
                >
                  {renderMealSections(true)}
                </Box>
              </Box>
            </Box>
          ) : (
            <>
              {dateChrome}
              {summaryCard}
              {hydrationRow}
              {nutritionHeader}
              {entries.length === 0 && !isInitialLoading ? (
                <Box
                  className="mb-3 gap-2 border px-4 py-3"
                  style={{
                    borderWidth: borders.width,
                    borderColor: colors.primary,
                    backgroundColor: `${colors.primary}10`,
                    borderRadius: radii.none,
                  }}
                >
                  <Box className="flex-row items-center gap-2">
                    <Feather name="arrow-down" size={14} color={colors.primary} />
                    <Text
                      size="xs"
                      bold
                      style={{ fontFamily: fonts.mono, color: colors.text, letterSpacing: 0.04 }}
                    >
                      Your diary is empty. Tap Log food to start
                    </Text>
                  </Box>
                  <Pressable
                    onPress={() => setLogSlotOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Log food to start diary"
                    className="mt-1 flex-row items-center justify-center gap-1.5 self-start px-4 active:opacity-80"
                    style={{
                      backgroundColor: colors.primary,
                      borderWidth: borders.width,
                      borderColor: colors.primary,
                      borderRadius: radii.none,
                      paddingVertical: 8,
                    }}
                  >
                    <Feather name="plus" size={14} color={colors.onPrimary} />
                    <Text
                      size="xs"
                      bold
                      style={{
                        color: colors.onPrimary,
                        fontFamily: fonts.mono,
                        textTransform: "uppercase",
                        letterSpacing: 0.06,
                      }}
                    >
                      Log food
                    </Text>
                  </Pressable>
                </Box>
              ) : null}
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

      {isWide && Platform.OS === "web" ? (
        <Pressable
          onPress={() => setShowShortcuts(true)}
          accessibilityRole="button"
          accessibilityLabel="Show keyboard shortcuts"
          style={{
            position: "absolute",
            bottom: isLarge ? 96 : 88,
            right: 24,
            borderWidth: borders.width,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: 12,
            paddingVertical: 7,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Text
            size="2xs"
            bold
            style={{ fontFamily: fonts.mono, letterSpacing: 0.06, color: colors.textMuted }}
          >
            ? Shortcuts
          </Text>
        </Pressable>
      ) : null}

      <Modal
        visible={showShortcuts}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShortcuts(false)}
        {...(Platform.OS === "android"
          ? { statusBarTranslucent: true, hardwareAccelerated: true }
          : {})}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowShortcuts(false)}
            accessibilityRole="button"
            accessibilityLabel="Close shortcuts"
          />
          <View style={{ width: "100%", maxWidth: 420 }}>
            <Pressable
              onPress={() => setShowShortcuts(false)}
              accessibilityRole="button"
              accessibilityLabel="Close shortcuts dialog"
              style={{
                width: "100%",
                maxWidth: 420,
                backgroundColor: colors.surface,
                borderWidth: borders.width,
                borderColor: colors.border,
                padding: 16,
                gap: 12,
              }}
            >
              <Box className="flex-row items-center justify-between">
                <Text size="sm" bold style={{ fontFamily: fonts.mono, letterSpacing: 0.04 }}>
                  Keyboard shortcuts
                </Text>
                <Feather name="x" size={16} color={colors.textMuted} />
              </Box>
              <Box className="gap-2">
                {[
                  ["← →", "Previous / next day"],
                  ["N", "New entry"],
                  ["1 2 3 4", "Breakfast Lunch Dinner Snack"],
                  ["W", "Log water"],
                  ["E", "Log weight"],
                  ["C", "Copy from date"],
                  ["R", "Refresh from YAZIO"],
                  ["?", "Toggle this help"],
                  ["Esc", "Close dialog"],
                ].map(([k, v]) => (
                  <Box key={k} className="flex-row items-center justify-between gap-4">
                    <Box
                      className="rounded-none border bg-background-100 px-2 py-1"
                      style={{ borderWidth: borders.widthThin, borderColor: colors.border }}
                    >
                      <Text size="xs" bold style={{ fontFamily: fonts.mono }}>
                        {k}
                      </Text>
                    </Box>
                    <Text size="xs" style={{ fontFamily: fonts.mono, color: colors.textMuted }}>
                      {v}
                    </Text>
                  </Box>
                ))}
              </Box>
              <Text size="2xs" style={{ fontFamily: fonts.mono, color: colors.textMuted }}>
                Shortcuts work when no input is focused and no modal is open.
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <DatePickerModal
        visible={pickerOpen}
        dateKey={dateKey}
        onSelect={(key) => setDateKeyTransition(key)}
        onClose={() => setPickerOpen(false)}
      />

      <CopyFromDateModal
        visible={copyPickerOpen}
        targetDateKey={dateKey}
        initialDateKey={shiftDateKey(dateKey, -1)}
        onCopy={handleCopyFromPreview}
        onClose={() => setCopyPickerOpen(false)}
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
          bottomOffset={isWide ? (isLarge ? 28 : 24) : 8}
          insetX={isWide ? 24 : 20}
          right={
            <Fab
              size="md"
              icon="plus"
              label="Log food"
              onPress={() => setLogSlotOpen(true)}
              accessibilityLabel="Log food into diary"
            />
          }
        />
      ) : null}
    </Box>
  )
}
