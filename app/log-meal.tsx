import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  FlatList,
  ScrollView,
  ActivityIndicator,
} from "react-native"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import { Swipeable } from "react-native-gesture-handler"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FoodListItem } from "@/components/FoodListItem"
import { SortableFavoriteList } from "@/components/SortableFavoriteList"
import { EmptyState } from "@/components/EmptyState"
import { OfflineBanner } from "@/components/OfflineBanner"
import { CreateOptionsModal } from "@/components/CreateOptionsModal"
import { useDebounce } from "@/hooks/useDebounce"
import { useFoodSearch } from "@/hooks/useFoodSearch"
import { useKeyboardHeight } from "@/hooks/useKeyboardVisible"
import { useApp } from "@/context/AppContext"
import { useToast } from "@/context/ToastContext"
import { getFoodIcon } from "@/utils/food-icon"
import { getSuggestedFoods } from "@/services/yazio/foods"
import { getFavoriteFoods, getRecentFoodUsages, updateFavoriteOrder } from "@/db/food-cache"
import { deleteFoodEntry, getDiaryEntriesForDate, quickLogFood } from "@/services/diary"
import { duplicateMeal, listMeals, logMealToDiary, mealTotals } from "@/services/meals"
import type {
  DiaryEntry,
  FoodNutrients,
  Meal,
  MealType,
  RecentFoodUsage,
  SearchFoodResult,
} from "@/types"
import {
  filterFoodsByQuery,
  filterRecentUsagesByQuery,
  mergeFoodResults,
} from "@/utils/food-search"
import { normalizedSearchAmount, sumNutrients } from "@/utils/nutrients"
import { MEAL_LABELS, MEAL_ICONS } from "@/utils/meals"
import { displayUnit, formatEntryAmount } from "@/utils/food-display"
import { formatNumber, formatThousands } from "@/utils/format"
import { confirmAction } from "@/utils/confirm"
import { formatDisplayDate, toDateKey } from "@/utils/date"
import { routeParam } from "@/utils/route"
import { useTheme } from "@/hooks/useTheme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useSafeBack } from "@/hooks/useSafeBack"
import { ModalContainer } from "@/components/ModalContainer"
import { MealListItem } from "@/components/MealListItem"
import { MacroPills } from "@/components/MacroPills"
import { spacing, fonts, type ColorPalette, borders, radii } from "@/theme"

type FoodCategory = "foods" | "meals"
type ListMode = "frequent" | "recent" | "favorites"
export type ActiveTab = "frequent" | "recent" | "favorites" | "meals"

interface TabOption {
  id: ActiveTab
  label: string
  icon: keyof typeof Feather.glyphMap
  activeIcon: keyof typeof Feather.glyphMap
}

const TABS: TabOption[] = [
  { id: "frequent", label: "Frequent", icon: "zap", activeIcon: "zap" },
  { id: "recent", label: "Recent", icon: "clock", activeIcon: "clock" },
  { id: "favorites", label: "Favorites", icon: "star", activeIcon: "star" },
  { id: "meals", label: "Meals", icon: "shopping-bag", activeIcon: "shopping-bag" },
]

const ZERO_TOTALS: FoodNutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

type FoodRow = SearchFoodResult | RecentFoodUsage

function isUsageRow(row: FoodRow): row is RecentFoodUsage {
  return "lastLoggedAt" in row
}

/** Distinct foods from usage rows, keeping the most-recently-used order. */
function usageFoods(usages: RecentFoodUsage[]): SearchFoodResult[] {
  const seen = new Set<string>()
  const foods: SearchFoodResult[] = []
  for (const usage of usages) {
    if (!seen.has(usage.food.product_id)) {
      seen.add(usage.food.product_id)
      foods.push(usage.food)
    }
  }
  return foods
}

export default function LogMealScreen() {
  const router = useRouter()
  const safeBack = useSafeBack()
  const params = useLocalSearchParams<{ meal?: string; date?: string }>()
  const mealType = (routeParam(params.meal) ?? "lunch") as MealType
  const date = routeParam(params.date) ?? toDateKey()
  const { settings, yazioAvailable } = useApp()
  const { showError, showWarning, showSuccess, showUndoFab } = useToast()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()

  const accent = colors[mealType]

  const [category, setCategory] = useState<FoodCategory>("foods")
  const [query, setQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<TextInput>(null)
  const debounced = useDebounce(query, 200)
  const [listMode, setListMode] = useState<ListMode>("frequent")
  const [meals, setMeals] = useState<Meal[]>([])
  const [loggingMealId, setLoggingMealId] = useState<string | null>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [reorderFavorites, setReorderFavorites] = useState(false)

  const activeTab: ActiveTab = category === "meals" ? "meals" : listMode

  const openSearch = useCallback(() => {
    setSearchOpen(true)
  }, [])

  const closeSearch = useCallback(() => {
    setQuery("")
    setSearchOpen(false)
    searchInputRef.current?.blur()
  }, [])

  const handleTabPress = useCallback((tabId: ActiveTab) => {
    setReorderFavorites(false)
    if (tabId === "meals") {
      setCategory("meals")
    } else {
      setCategory("foods")
      setListMode(tabId)
    }
  }, [])
  // YAZIO's suggestions for this meal slot arrive async and patch into the
  // "Frequent" list, so the local favorites/recents render instantly instead of
  // waiting on the network.
  const [suggestions, setSuggestions] = useState<SearchFoodResult[]>([])
  const [dayEntries, setDayEntries] = useState<DiaryEntry[]>([])
  const [loggedEntries, setLoggedEntries] = useState<DiaryEntry[]>([])
  // Logged card is compact by default, one strip, and expandable. While
  // searching it also collapses so results start at the top. The query it
  // was opened under is stored so changing the query collapses it again.
  const [loggedExpanded, setLoggedExpanded] = useState(false)
  const [loggedOpenQuery, setLoggedOpenQuery] = useState<string | null>(null)
  // Quick-add in-flight row key, product id or product id plus amount.
  const [addingKey, setAddingKey] = useState<string | null>(null)
  // Open swipeable logged rows, so a cancelled swipe-delete can snap back.
  const swipeableRefs = useRef(new Map<string, Swipeable | null>())
  const { keyboardHeight } = useKeyboardHeight()

  const loadLoggedEntries = useCallback(async () => {
    try {
      const entries = await getDiaryEntriesForDate(date, { remote: false })
      setDayEntries(entries)
      setLoggedEntries(entries.filter((entry) => entry.meal_type === mealType))
    } catch {
      setDayEntries([])
      setLoggedEntries([])
    }
  }, [date, mealType])

  const dayTotals = useMemo(() => sumNutrients(dayEntries), [dayEntries])

  const loggedExpandedInSearch = debounced.trim().length > 0 && loggedOpenQuery === debounced
  const isLoggedExpanded = debounced.trim() ? loggedExpandedInSearch : loggedExpanded

  // Receipt flash on the day budget badge: when the day total moves (a
  // quick-add or meal log landed), the badge inverts to solid ink for a
  // beat. Emphasis by invert, not motion, so Reduce Motion is unaffected.
  const [budgetBadgeFlash, setBudgetBadgeFlash] = useState(false)
  const prevDayKcalRef = useRef(dayTotals.kcal)
  useEffect(() => {
    if (prevDayKcalRef.current !== dayTotals.kcal) {
      prevDayKcalRef.current = dayTotals.kcal
      setBudgetBadgeFlash(true)
      const timer = setTimeout(() => setBudgetBadgeFlash(false), 900)
      return () => clearTimeout(timer)
    }
  }, [dayTotals.kcal])
  const mealTotalsValues = useMemo(() => sumNutrients(loggedEntries), [loggedEntries])

  const mealKcal = Math.round(mealTotalsValues.kcal)

  const dayRemainingKcal = Math.max(settings.calorie_goal - dayTotals.kcal, 0)
  const dayOverKcal =
    settings.calorie_goal > 0 && dayTotals.kcal > settings.calorie_goal
      ? dayTotals.kcal - settings.calorie_goal
      : 0

  const dayProteinRemaining = Math.max((settings.protein_goal || 0) - dayTotals.protein, 0)
  const dayCarbsRemaining = Math.max((settings.carbs_goal || 0) - dayTotals.carbs, 0)
  const dayFatRemaining = Math.max((settings.fat_goal || 0) - dayTotals.fat, 0)
  const dayGoalKcal = Math.round(settings.calorie_goal)
  const dayConsumedKcal = Math.round(dayTotals.kcal)
  const dayProgressPct = dayGoalKcal > 0 ? Math.min((dayTotals.kcal / dayGoalKcal) * 100, 100) : 0

  const [favoriteFoods, setFavoriteFoods] = useState<SearchFoodResult[]>([])
  const [recentUsages, setRecentUsages] = useState<RecentFoodUsage[]>([])

  const loadFavorites = useCallback(async () => {
    try {
      const items = await getFavoriteFoods()
      setFavoriteFoods(items)
    } catch {
      setFavoriteFoods([])
    }
  }, [])

  const loadRecents = useCallback(async () => {
    try {
      const usages = await getRecentFoodUsages(30)
      setRecentUsages(usages)
    } catch {
      setRecentUsages([])
    }
  }, [])

  const loadMeals = useCallback(async () => {
    try {
      setMeals(await listMeals())
    } catch (error) {
      showError(error, "Could not load meals.")
    }
  }, [showError])

  useEffect(() => {
    if (category !== "foods" || debounced.trim() || listMode !== "frequent") return
    let cancelled = false
    getSuggestedFoods(date, mealType, 5)
      .then((items) => {
        if (!cancelled) setSuggestions(items)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [category, date, debounced, listMode, mealType])

  const handleSearchError = useCallback(
    (error: unknown) => showError(error, "Could not load foods."),
    [showError],
  )

  const {
    foods: searchFoods,
    loading,
    refresh,
  } = useFoodSearch<SearchFoodResult>(debounced, {
    enabled: category === "foods" && activeTab === "frequent" && Boolean(debounced.trim()),
    onError: handleSearchError,
  })

  const loadAllData = useCallback(async () => {
    await Promise.all([loadLoggedEntries(), loadFavorites(), loadRecents(), loadMeals()])
  }, [loadFavorites, loadLoggedEntries, loadMeals, loadRecents])

  // Refetch favorites/recent/meals/logged entries when returning from add-food or meal-builder.
  useFocusEffect(
    useCallback(() => {
      void loadAllData()
      if (activeTab === "frequent" && debounced.trim()) {
        refresh()
      }
    }, [activeTab, debounced, loadAllData, refresh]),
  )

  const frequentList = useMemo(() => {
    return mergeFoodResults(mergeFoodResults(suggestions, favoriteFoods), usageFoods(recentUsages))
  }, [suggestions, favoriteFoods, recentUsages])

  const filteredFavorites = useMemo(
    () => filterFoodsByQuery(favoriteFoods, debounced),
    [debounced, favoriteFoods],
  )

  const filteredRecents = useMemo(
    () => filterRecentUsagesByQuery(recentUsages, debounced),
    [debounced, recentUsages],
  )

  const filteredMeals = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    if (!q) return meals
    return meals.filter((meal) => meal.name.toLowerCase().includes(q))
  }, [debounced, meals])

  const activeFoodItems: FoodRow[] = useMemo(() => {
    if (activeTab === "favorites") {
      return filteredFavorites
    }
    if (activeTab === "recent") {
      return filteredRecents
    }
    return debounced.trim() ? searchFoods : frequentList
  }, [activeTab, debounced, filteredFavorites, filteredRecents, frequentList, searchFoods])

  const openFood = useCallback(
    (food: SearchFoodResult) => {
      router.push({
        pathname: "/add-food",
        params: { meal: mealType, date, productId: food.product_id },
      })
    },
    [date, mealType, router],
  )

  const handleQuickAdd = useCallback(
    async (food: SearchFoodResult, amount?: number) => {
      const targetAmount = amount ?? food.last_amount
      const key = targetAmount != null ? `${food.product_id}:${targetAmount}` : food.product_id
      if (addingKey === key) return
      setAddingKey(key)
      try {
        const { entry } = await quickLogFood({
          date,
          mealType,
          food,
          amount: targetAmount,
        })
        await loadLoggedEntries()
        await loadRecents()
        // Show only the small Undo FAB, no huge toast banner that covers the dock.
        showUndoFab(`${food.name} added`, () => {
          deleteFoodEntry(entry.id)
            .then(async () => {
              await loadLoggedEntries()
              await loadRecents()
            })
            .catch(() => undefined)
        })
      } catch (error) {
        showError(error, "Could not add food.")
      } finally {
        setAddingKey(null)
      }
    },
    [addingKey, date, loadLoggedEntries, loadRecents, mealType, showError, showUndoFab],
  )

  const openEdit = useCallback(
    (entry: DiaryEntry) => {
      router.push({
        pathname: "/add-food",
        params: { entryId: entry.id, meal: mealType, date },
      })
    },
    [date, mealType, router],
  )

  const onDeleteEntry = useCallback(
    (entry: DiaryEntry) => {
      confirmAction({
        title: "Delete entry?",
        message: `Remove "${entry.food_name}" from ${formatDisplayDate(date)}?`,
        confirmLabel: "Delete",
        onConfirm: async () => {
          try {
            await deleteFoodEntry(entry.id)
            await loadLoggedEntries()
          } catch (error) {
            showError(error, "Could not delete entry.")
          }
        },
        onCancel: () => swipeableRefs.current.get(entry.id)?.close(),
      })
    },
    [date, loadLoggedEntries, showError],
  )

  const handleLogMeal = useCallback(
    async (meal: Meal) => {
      if (loggingMealId) return
      setLoggingMealId(meal.id)
      try {
        const { logged, skipped } = await logMealToDiary({ date, mealType, meal })
        if (logged === 0) {
          showWarning("No items in this meal could be logged.", "Nothing logged")
        } else {
          showSuccess(
            logged === 1
              ? `Logged 1 item from "${meal.name}".`
              : `Logged ${logged} items from "${meal.name}".`,
            "Meal logged",
          )
          // Staying on screen means the receipt must repaint here too:
          // refresh the logged section and the daily budget bar. No list
          // refresh: logging a meal must not flash the foods FlatList.
          await loadLoggedEntries()
        }
        if (skipped.length > 0) {
          showWarning(
            `Could not log: ${skipped.join(", ")}. Check your connection and try again.`,
            "Some items skipped",
          )
        }
        // Stay on screen after a successful log. The logged section updates
        // in place and dismissal stays manual, X or system back. The old
        // dismissAll dumped users on the dashboard mid-browse.
      } catch (error) {
        showError(error, "Could not log this meal.")
      } finally {
        setLoggingMealId(null)
      }
    },
    [date, loadLoggedEntries, loggingMealId, mealType, showError, showSuccess, showWarning],
  )

  const handleDuplicateMeal = useCallback(
    async (meal: Meal) => {
      try {
        const dup = await duplicateMeal(meal.id)
        await loadMeals()
        showSuccess(`Duplicated "${dup.name}".`, "Meal duplicated")
      } catch (error) {
        showError(error, "Could not duplicate meal.")
      }
    },
    [loadMeals, showError, showSuccess],
  )

  const handleReorderFavorites = useCallback(
    async (reordered: SearchFoodResult[]) => {
      const orderedIds = reordered.map((f) => f.product_id)
      setFavoriteFoods(reordered)
      await updateFavoriteOrder(orderedIds)
      await loadFavorites()
    },
    [loadFavorites],
  )

  const moveFavorite = useCallback(
    async (index: number, direction: -1 | 1) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= favoriteFoods.length) return
      const currentList = [...favoriteFoods]
      const [item] = currentList.splice(index, 1)
      currentList.splice(targetIndex, 0, item)
      setFavoriteFoods(currentList)
      const orderedIds = currentList.map((f) => f.product_id)
      await updateFavoriteOrder(orderedIds)
    },
    [favoriteFoods],
  )

  const renderFood = useCallback(
    ({ item, index }: { item: FoodRow; index: number }) => {
      const isFavMode = category === "foods" && listMode === "favorites" && !debounced.trim()
      const isReordering = isFavMode && reorderFavorites

      if (isUsageRow(item)) {
        return (
          <FoodListItem
            food={item.food}
            amount={item.amount}
            accentColor={accent}
            quickAddVariant="pill"
            onPress={() => openFood(item.food)}
            onQuickAdd={() => handleQuickAdd(item.food, item.amount)}
            quickAdding={addingKey === `${item.food.product_id}:${item.amount}`}
            isReordering={isReordering}
            canMoveUp={index > 0}
            canMoveDown={index < activeFoodItems.length - 1}
            onMoveUp={() => moveFavorite(index, -1)}
            onMoveDown={() => moveFavorite(index, 1)}
          />
        )
      }
      // Search results on Frequent normalize to standard 100g/ml baseline for comparison.
      // Favorites and Recents retain personal/custom logged amounts.
      const searching = Boolean(debounced.trim())
      const quickAmount =
        searching && activeTab === "frequent" ? normalizedSearchAmount(item.base_unit) : undefined
      return (
        <FoodListItem
          food={item}
          amount={quickAmount}
          accentColor={accent}
          quickAddVariant="pill"
          onPress={() => openFood(item)}
          onQuickAdd={() => handleQuickAdd(item, quickAmount)}
          quickAdding={
            addingKey ===
            (quickAmount != null ? `${item.product_id}:${quickAmount}` : item.product_id)
          }
          isReordering={isReordering}
          canMoveUp={index > 0}
          canMoveDown={index < activeFoodItems.length - 1}
          onMoveUp={() => moveFavorite(index, -1)}
          onMoveDown={() => moveFavorite(index, 1)}
        />
      )
    },
    [
      accent,
      activeFoodItems.length,
      activeTab,
      addingKey,
      category,
      debounced,
      handleQuickAdd,
      listMode,
      moveFavorite,
      openFood,
      reorderFavorites,
    ],
  )

  const mealTotalsById = useMemo(() => {
    const map = new Map<string, FoodNutrients>()
    for (const meal of meals) map.set(meal.id, mealTotals(meal))
    return map
  }, [meals])

  const renderMeal = useCallback(
    ({ item }: { item: Meal }) => {
      const totals = mealTotalsById.get(item.id) ?? ZERO_TOTALS
      return (
        <MealListItem
          meal={item}
          totals={totals}
          // Row press previews/edits in the builder. Committing 871 kcal
          // from an unlabeled tap was a trap; the explicit accent key below
          // is the only log control.
          onPress={() =>
            router.push({
              pathname: "/meal-builder",
              params: { mealId: item.id },
            })
          }
          onLog={() => handleLogMeal(item)}
          onEdit={() =>
            router.push({
              pathname: "/meal-builder",
              params: { mealId: item.id },
            })
          }
          onDuplicate={() => handleDuplicateMeal(item)}
          logging={loggingMealId === item.id}
          accentColor={accent}
        />
      )
    },
    [accent, handleDuplicateMeal, handleLogMeal, loggingMealId, mealTotalsById, router],
  )

  const searchPlaceholder = useMemo(() => {
    switch (activeTab) {
      case "meals":
        return "Search meals…"
      case "favorites":
        return "Search favorites…"
      case "recent":
        return "Search recent foods…"
      case "frequent":
      default:
        return "Search foods…"
    }
  }, [activeTab])

  const emptyInfo = useMemo((): { title: string; action?: ReactNode } => {
    const q = debounced.trim()
    if (category === "meals") {
      if (q) {
        return {
          title: `No meals match "${q}".`,
          action: (
            <Pressable
              style={[styles.emptyActionBtn, { borderColor: accent }]}
              onPress={() => handleTabPress("frequent")}
              accessibilityRole="button"
              accessibilityLabel={`Search all foods for ${q}`}
            >
              <Feather name="search" size={14} color={accent} />
              <Text style={[styles.emptyActionText, { color: accent }]}>
                {`Search all foods for "${q}"`}
              </Text>
            </Pressable>
          ),
        }
      }
      return {
        title: "No meals yet. Create one to see it here.",
        action: (
          <Pressable
            style={[styles.emptyActionBtn, { borderColor: accent }]}
            onPress={() => router.push({ pathname: "/meal-builder" })}
            accessibilityRole="button"
            accessibilityLabel="Create a new meal"
          >
            <Feather name="plus" size={14} color={accent} />
            <Text style={[styles.emptyActionText, { color: accent }]}>New meal</Text>
          </Pressable>
        ),
      }
    }

    if (listMode === "favorites") {
      if (q) {
        return {
          title: `No favorites match "${q}".`,
          action: (
            <Pressable
              style={[styles.emptyActionBtn, { borderColor: accent }]}
              onPress={() => handleTabPress("frequent")}
              accessibilityRole="button"
              accessibilityLabel={`Search all foods for ${q}`}
            >
              <Feather name="search" size={14} color={accent} />
              <Text style={[styles.emptyActionText, { color: accent }]}>
                {`Search all foods for "${q}"`}
              </Text>
            </Pressable>
          ),
        }
      }
      return { title: "No favorites yet. Star foods to see them here." }
    }

    if (listMode === "recent") {
      if (q) {
        return {
          title: `No recent foods match "${q}".`,
          action: (
            <Pressable
              style={[styles.emptyActionBtn, { borderColor: accent }]}
              onPress={() => handleTabPress("frequent")}
              accessibilityRole="button"
              accessibilityLabel={`Search all foods for ${q}`}
            >
              <Feather name="search" size={14} color={accent} />
              <Text style={[styles.emptyActionText, { color: accent }]}>
                {`Search all foods for "${q}"`}
              </Text>
            </Pressable>
          ),
        }
      }
      return { title: "No recent foods yet. Log something to see it here." }
    }

    // Frequent:
    if (q) {
      return {
        title: `No foods found matching "${q}".`,
        action: (
          <Pressable
            style={[styles.emptyActionBtn, { borderColor: accent }]}
            onPress={() => router.push({ pathname: "/scan", params: { meal: mealType, date } })}
            accessibilityRole="button"
            accessibilityLabel="Scan barcode"
          >
            <MaterialCommunityIcons name="barcode-scan" size={15} color={accent} />
            <Text style={[styles.emptyActionText, { color: accent }]}>Scan barcode</Text>
          </Pressable>
        ),
      }
    }
    return { title: "Search or scan to log food." }
  }, [accent, category, date, debounced, handleTabPress, listMode, mealType, router, styles])

  const filterStatusBar = useMemo(() => {
    const q = debounced.trim()
    if (!q) return null
    const count = category === "meals" ? filteredMeals.length : activeFoodItems.length
    return (
      <View style={styles.filterStatusRow}>
        <View style={styles.filterStatusLeft}>
          <Feather name="filter" size={12} color={accent} />
          <Text style={[styles.filterStatusText, { color: colors.textMuted }]} numberOfLines={1}>
            {activeTab === "frequent"
              ? loading
                ? `SEARCHING ALL FOODS FOR "${q.toUpperCase()}"…`
                : `${count} RESULT${count === 1 ? "" : "S"} FOR "${q.toUpperCase()}"`
              : `${count} MATCH${count === 1 ? "" : "ES"} IN ${activeTab.toUpperCase()}`}
          </Text>
        </View>
        <Pressable
          onPress={() => setQuery("")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search filter"
        >
          <Text style={[styles.filterStatusClear, { color: accent }]}>CLEAR</Text>
        </Pressable>
      </View>
    )
  }, [
    accent,
    activeFoodItems.length,
    activeTab,
    category,
    colors.textMuted,
    debounced,
    filteredMeals.length,
    loading,
    styles,
  ])

  const listFooter = useMemo(() => {
    const q = debounced.trim()
    if (!q) return null
    if (activeTab === "frequent") return null
    return (
      <Pressable
        style={[styles.searchAllFooter, { borderColor: `${accent}40` }]}
        onPress={() => handleTabPress("frequent")}
        accessibilityRole="button"
        accessibilityLabel={`Search all foods for ${q}`}
      >
        <Feather name="search" size={14} color={accent} />
        <Text style={[styles.searchAllFooterText, { color: accent }]}>
          {`Search all foods for "${q}"`}
        </Text>
        <Feather name="arrow-right" size={14} color={accent} />
      </Pressable>
    )
  }, [accent, activeTab, debounced, handleTabPress, styles])

  const loggedSection =
    loggedEntries.length > 0 ? (
      <View style={styles.loggedWrapCompact}>
        <Pressable
          style={styles.loggedCollapsedBarCompact}
          hitSlop={8}
          onPress={() => {
            if (debounced.trim()) {
              setLoggedOpenQuery(isLoggedExpanded ? null : debounced)
            } else {
              setLoggedExpanded((v) => !v)
            }
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded: isLoggedExpanded }}
          accessibilityLabel={`Logged in ${MEAL_LABELS[mealType]} · ${loggedEntries.length} ${
            loggedEntries.length === 1 ? "item" : "items"
          } · ${mealKcal} kcal. Tap to ${isLoggedExpanded ? "collapse" : "expand"}.`}
        >
          <Feather
            name={isLoggedExpanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={colors.textMuted}
          />
          <Text style={styles.loggedCollapsedTextCompact} numberOfLines={1}>
            Logged in {MEAL_LABELS[mealType]} · {loggedEntries.length}{" "}
            {loggedEntries.length === 1 ? "item" : "items"} · {mealKcal} kcal
          </Text>
        </Pressable>
        {!isLoggedExpanded ? (
          <View style={styles.loggedCollapsedPreview}>
            {loggedEntries.slice(0, 3).map((e) => (
              <View key={e.id} style={styles.loggedCollapsedPreviewRow}>
                <Text style={styles.loggedCollapsedPreviewItem} numberOfLines={1}>
                  {e.food_name}
                </Text>
                <Text style={styles.loggedCollapsedPreviewText}>
                  {formatNumber(e.amount)}
                  {displayUnit(e.unit)} · {Math.round(e.kcal)} kcal
                </Text>
              </View>
            ))}
            {loggedEntries.length > 3 ? (
              <Text style={styles.loggedCollapsedPreviewMore}>
                +{loggedEntries.length - 3} more · tap to expand
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <View style={styles.loggedHeaderCompact}>
              <MacroPills
                protein={mealTotalsValues.protein}
                carbs={mealTotalsValues.carbs}
                fat={mealTotalsValues.fat}
                size="xs"
              />
            </View>
            <ScrollView
              style={styles.loggedList}
              contentContainerStyle={{ gap: 0 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {loggedEntries.map((entry) => (
                <Swipeable
                  key={entry.id}
                  ref={(ref) => {
                    if (ref) swipeableRefs.current.set(entry.id, ref)
                    else swipeableRefs.current.delete(entry.id)
                  }}
                  overshootRight={false}
                  renderRightActions={() => (
                    <Pressable
                      style={styles.swipeDelete}
                      onPress={() => onDeleteEntry(entry)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${entry.food_name}`}
                    >
                      <Feather name="trash-2" size={18} color={colors.onPrimary} />
                    </Pressable>
                  )}
                  onSwipeableOpen={() => onDeleteEntry(entry)}
                >
                  <View style={styles.loggedRow}>
                    <Pressable
                      style={styles.loggedMain}
                      onPress={() => openEdit(entry)}
                      accessibilityRole="button"
                      // Mirrors the visible name + portion + kcal + macro pills (2.5.3).
                      accessibilityLabel={`Edit ${entry.food_name}, ${formatNumber(entry.amount)} ${displayUnit(entry.unit)}, ${Math.round(entry.kcal)} kcal, ${formatNumber(entry.protein)}g ${formatNumber(entry.carbs)}g ${formatNumber(entry.fat)}g`}
                    >
                      <View style={[styles.loggedIconWrap, { backgroundColor: `${accent}18` }]}>
                        <MaterialCommunityIcons
                          name={getFoodIcon(entry.food_name, entry)}
                          size={20}
                          color={accent}
                        />
                      </View>
                      <View style={styles.loggedInfo}>
                        <Text style={styles.loggedName}>{entry.food_name}</Text>
                        <View style={styles.loggedSubRow}>
                          <Text style={styles.loggedSub}>
                            {formatEntryAmount(entry)} · {Math.round(entry.kcal)} kcal
                          </Text>
                          <MacroPills
                            protein={entry.protein}
                            carbs={entry.carbs}
                            fat={entry.fat}
                            size="xs"
                          />
                        </View>
                      </View>
                    </Pressable>
                    <Pressable
                      style={[styles.loggedIconBtn, { backgroundColor: `${accent}1a` }]}
                      onPress={() => openEdit(entry)}
                      hitSlop={8}
                      accessibilityRole="button"
                      // "details" disambiguates from the row's own edit action.
                      accessibilityLabel={`Edit ${entry.food_name} details`}
                    >
                      <Feather name="edit-2" size={16} color={accent} />
                    </Pressable>
                    <Pressable
                      style={[styles.loggedIconBtn, { backgroundColor: `${colors.danger}1a` }]}
                      onPress={() => onDeleteEntry(entry)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${entry.food_name}`}
                    >
                      <Feather name="trash-2" size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                </Swipeable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    ) : null

  const favoritesToolbar =
    category === "foods" &&
    listMode === "favorites" &&
    !debounced.trim() &&
    favoriteFoods.length > 1 ? (
      <View style={styles.reorderBar}>
        <Text style={styles.reorderTitle}>
          {favoriteFoods.length} {favoriteFoods.length === 1 ? "Favorite" : "Favorites"}
        </Text>
        <Pressable
          style={[
            styles.reorderBtn,
            reorderFavorites && { backgroundColor: accent, borderColor: accent },
          ]}
          onPress={() => setReorderFavorites((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={reorderFavorites ? "Done reordering" : "Reorder favorites"}
        >
          <Feather
            name={reorderFavorites ? "check-circle" : "repeat"}
            size={15}
            color={reorderFavorites ? colors.onPrimary : colors.text}
          />
          <Text style={[styles.reorderBtnText, reorderFavorites && { color: colors.onPrimary }]}>
            {reorderFavorites ? "Done" : "Reorder"}
          </Text>
        </Pressable>
      </View>
    ) : null

  const safeBottom = insets.bottom
  const bottomOffset = keyboardHeight > 0 ? keyboardHeight + 8 : safeBottom + 12

  return (
    <View style={styles.container}>
      <ModalContainer surface>
        {/* Compact Merged Header: Meal Icon + Title + Kcal + 3-Dot More Menu */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.mealIconBox, { backgroundColor: `${accent}20` }]}>
              <Feather name={MEAL_ICONS[mealType]} size={18} color={accent} />
            </View>
            <Text style={styles.title}>{MEAL_LABELS[mealType]}</Text>
            <Text style={styles.headerKcal}>
              {mealKcal} <Text style={styles.headerUnit}>kcal</Text>
            </Text>
          </View>

          <Pressable
            onPress={() => setOptionsOpen(true)}
            hitSlop={8}
            style={styles.moreBtn}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <Feather name="more-horizontal" size={20} color={colors.text} />
          </Pressable>
        </View>

        {/* Daily budget hero: big consumed-vs-goal number, progress, macros left */}
        {!searchOpen ? (
          <View style={styles.budgetBar}>
            <View style={styles.budgetTopRow}>
              <View style={styles.budgetNumbers}>
                <Text style={styles.budgetEyebrow}>Daily budget</Text>
                <Text
                  style={styles.budgetKcal}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatThousands(dayConsumedKcal)}
                  <Text style={styles.budgetKcalGoal}>
                    {dayGoalKcal > 0 ? ` / ${formatThousands(dayGoalKcal)} kcal` : " kcal"}
                  </Text>
                </Text>
              </View>

              {dayGoalKcal > 0 ? (
                <View
                  style={[
                    styles.dayBudgetBadge,
                    {
                      backgroundColor: budgetBadgeFlash
                        ? dayOverKcal > 0
                          ? colors.danger
                          : colors.primary
                        : dayOverKcal > 0
                          ? `${colors.danger}20`
                          : `${colors.primary}20`,
                      borderColor: dayOverKcal > 0 ? colors.danger : colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayBudgetBadgeText,
                      {
                        color: budgetBadgeFlash
                          ? colors.onPrimary
                          : dayOverKcal > 0
                            ? colors.danger
                            : colors.primary,
                      },
                    ]}
                  >
                    {dayOverKcal > 0
                      ? `+${formatThousands(Math.round(dayOverKcal))} over`
                      : `${formatThousands(Math.round(dayRemainingKcal))} left`}
                  </Text>
                </View>
              ) : null}
            </View>

            {dayGoalKcal > 0 ? (
              <View style={styles.budgetBarTrack}>
                <View
                  style={[
                    styles.budgetBarFill,
                    {
                      width: `${dayProgressPct}%`,
                      backgroundColor: dayOverKcal > 0 ? colors.danger : colors.primary,
                    },
                  ]}
                />
              </View>
            ) : null}

            <View style={styles.budgetPillsRow}>
              <Text style={styles.budgetMacrosLabel}>Macros left</Text>
              <MacroPills
                protein={dayProteinRemaining}
                carbs={dayCarbsRemaining}
                fat={dayFatRemaining}
                size="sm"
              />
            </View>
            {dayOverKcal > 0 ? (
              <Text style={styles.budgetHint}>Over budget · adjust tomorrow</Text>
            ) : null}
          </View>
        ) : null}

        {/* Always visible quick-switch tabs: Frequent, Recent, Favorites, Meals */}
        <View style={styles.tabBar} accessibilityRole="tablist">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <Pressable
                key={tab.id}
                onPress={() => handleTabPress(tab.id)}
                hitSlop={4}
                style={[
                  styles.tabItem,
                  isActive
                    ? [
                        styles.tabItemActive,
                        {
                          backgroundColor: `${accent}1f`,
                          borderColor: accent,
                        },
                      ]
                    : styles.tabItemInactive,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={tab.label}
              >
                <Feather
                  name={isActive ? tab.activeIcon : tab.icon}
                  size={14.5}
                  color={isActive ? accent : colors.textMuted}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isActive ? accent : colors.textMuted },
                    isActive && styles.tabLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <OfflineBanner visible={!yazioAvailable && debounced.length > 0} />

        {loading && activeFoodItems.length === 0 ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={accent} />
          </View>
        ) : loading ? (
          <View style={styles.loaderInline}>
            <ActivityIndicator size="small" color={accent} />
          </View>
        ) : null}

        {category === "foods" ? (
          listMode === "favorites" && !debounced.trim() && reorderFavorites ? (
            <FlatList
              style={styles.list}
              data={[]}
              renderItem={() => null}
              ListHeaderComponent={
                <>
                  {loggedSection ? (
                    <View style={styles.loggedSectionWrap}>{loggedSection}</View>
                  ) : null}
                  {favoritesToolbar}
                  <SortableFavoriteList
                    foods={favoriteFoods}
                    onReorder={handleReorderFavorites}
                    onOpenFood={openFood}
                    onMoveOne={moveFavorite}
                    accentColor={accent}
                  />
                </>
              }
            />
          ) : (
            <FlatList
              style={styles.list}
              data={activeFoodItems}
              keyExtractor={(item) =>
                isUsageRow(item) ? `${item.food.product_id}-${item.amount}` : item.product_id
              }
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              contentContainerClassName={
                activeFoodItems.length === 0 && !loading ? "grow justify-center" : "pt-1"
              }
              contentContainerStyle={{
                paddingBottom: keyboardHeight > 0 ? keyboardHeight + 76 : 112,
              }}
              ListHeaderComponent={
                <>
                  {loggedSection ? (
                    <View style={styles.loggedSectionWrap}>{loggedSection}</View>
                  ) : null}
                  {favoritesToolbar}
                  {filterStatusBar}
                </>
              }
              renderItem={renderFood}
              ListEmptyComponent={
                !loading ? (
                  <EmptyState
                    icon={
                      activeTab === "frequent"
                        ? debounced.trim()
                          ? "search"
                          : "zap"
                        : activeTab === "recent"
                          ? "clock"
                          : "star"
                    }
                    iconColor={accent}
                    title={emptyInfo.title}
                    action={emptyInfo.action}
                    variant="compact"
                  />
                ) : null
              }
              ListFooterComponent={listFooter}
            />
          )
        ) : (
          <FlatList
            style={styles.list}
            data={filteredMeals}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerClassName={
              filteredMeals.length === 0 && !loading ? "grow justify-center" : ""
            }
            contentContainerStyle={{
              paddingBottom: keyboardHeight > 0 ? keyboardHeight + 76 : 112,
            }}
            ListHeaderComponent={
              <>
                {loggedSection ? (
                  <View style={styles.loggedSectionWrap}>{loggedSection}</View>
                ) : null}
                <Pressable
                  style={styles.newMealBtn}
                  onPress={() => router.push({ pathname: "/meal-builder" })}
                  accessibilityRole="button"
                  accessibilityLabel="Create a new meal"
                >
                  <Feather name="shopping-bag" size={20} color={colors.onPrimary} />
                  <Text style={styles.newMealText}>New meal</Text>
                </Pressable>
                {filterStatusBar}
              </>
            }
            renderItem={renderMeal}
            ListEmptyComponent={
              !loading ? (
                <EmptyState
                  icon="shopping-bag"
                  iconColor={accent}
                  title={emptyInfo.title}
                  action={emptyInfo.action}
                  variant="compact"
                />
              ) : null
            }
            ListFooterComponent={listFooter}
          />
        )}

        {/* Bottom floating keys: transparent cluster, no dock bar. Search is
            a FAB that expands into a floating field in the same row as scan,
            so the two never overlap. */}
        <View style={[styles.bottomCluster, { bottom: bottomOffset }]} pointerEvents="box-none">
          <Pressable
            onPress={safeBack}
            hitSlop={8}
            style={styles.dockIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          {searchOpen ? (
            <View style={[styles.searchExpanded, { borderColor: accent }]}>
              <Pressable
                onPress={closeSearch}
                hitSlop={8}
                style={styles.searchCollapse}
                accessibilityRole="button"
                accessibilityLabel="Close search"
              >
                <Feather name="chevron-down" size={22} color={colors.textMuted} />
              </Pressable>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                // Borderless field inside the bordered container: focus draws
                // on the container via .logmeal-search-input in global.css.
                className="logmeal-search-input"
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoFocus
                returnKeyType="search"
                enterKeyHint="search"
                onSubmitEditing={() => searchInputRef.current?.blur()}
                accessibilityLabel={searchPlaceholder}
              />
              {query.length > 0 ? (
                <Pressable
                  style={styles.searchClear}
                  onPress={() => setQuery("")}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Feather name="x-circle" size={20} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Pressable
              onPress={openSearch}
              hitSlop={8}
              style={styles.searchFab}
              accessibilityRole="button"
              accessibilityLabel={searchPlaceholder}
            >
              <Feather name="search" size={20} color={colors.textMuted} />
              <Text style={styles.searchFabText} numberOfLines={1}>
                {searchPlaceholder}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push({ pathname: "/scan", params: { meal: mealType, date } })}
            hitSlop={8}
            style={[styles.dockIconBtn, styles.dockScanBtn]}
            accessibilityRole="button"
            accessibilityLabel="Scan barcode"
          >
            <MaterialCommunityIcons name="barcode-scan" size={24} color={colors.onPrimary} />
          </Pressable>
        </View>
      </ModalContainer>

      <CreateOptionsModal
        visible={optionsOpen}
        mealType={mealType}
        date={date}
        onClose={() => setOptionsOpen(false)}
      />
    </View>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    headerCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: radii.none,
      borderWidth: borders.width,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.sm,
    },
    mealIconBox: {
      width: 28,
      height: 28,
      borderRadius: radii.none,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    headerKcal: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      marginLeft: 2,
    },
    headerUnit: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      textTransform: "uppercase",
    },
    moreBtn: {
      width: 36,
      height: 36,
      borderRadius: radii.none,
      borderWidth: borders.width,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    tabBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginHorizontal: spacing.md,
      marginBottom: spacing.xs,
    },
    tabItem: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingVertical: 7,
      paddingHorizontal: 2,
      borderRadius: radii.none,
      borderWidth: borders.width,
    },
    tabItemActive: {},
    tabItemInactive: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    tabLabel: {
      fontSize: 11,
      fontWeight: "700",
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    tabLabelActive: {
      fontWeight: "800",
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      backgroundColor: "transparent",
      borderWidth: 0,
      paddingVertical: 12,
      fontSize: 15,
      fontWeight: "700",
      fontFamily: fonts.mono,
      letterSpacing: 0.4,
      color: colors.text,
    },
    searchClear: {
      width: 44,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    bottomCluster: {
      position: "absolute",
      left: spacing.md,
      right: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      zIndex: 10,
      elevation: 5,
    },
    searchFab: {
      flex: 1,
      minWidth: 0,
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.none,
      borderWidth: borders.width,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    searchFabText: {
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      fontWeight: "600",
      fontFamily: fonts.mono,
      letterSpacing: 0.4,
      color: colors.textMuted,
    },
    searchExpanded: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      minHeight: 56,
      backgroundColor: colors.surface,
      borderRadius: radii.none,
      borderWidth: borders.width,
      paddingLeft: 2,
      paddingRight: 2,
      gap: 2,
    },
    searchCollapse: {
      width: 44,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    dockIconBtn: {
      width: 56,
      height: 56,
      borderRadius: radii.none,
      borderWidth: borders.width,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    swipeDelete: {
      width: 72,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.danger,
    },
    dockScanBtn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    loader: { marginVertical: spacing.sm },
    loaderWrap: {
      paddingVertical: spacing.md,
      alignItems: "center",
      justifyContent: "center",
    },
    loaderInline: {
      paddingVertical: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    list: { flex: 1 },
    newMealBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radii.none,
      backgroundColor: colors.primary,
    },
    newMealText: { color: colors.onPrimary, fontWeight: "700", fontSize: 16 },
    loggedSectionWrap: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      maxHeight: 260,
      borderRadius: radii.none,
      borderWidth: borders.width,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: "hidden",
    },
    loggedWrap: {
      padding: spacing.md,
      borderRadius: radii.none,
      backgroundColor: colors.surface,
      maxHeight: 260,
    },
    loggedList: {
      maxHeight: 160,
      gap: 0,
    },
    loggedWrapCompact: {
      padding: spacing.sm,
      borderRadius: radii.none,
      backgroundColor: colors.surface,
    },
    loggedCollapsedBarCompact: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    loggedCollapsedTextCompact: {
      flex: 1,
      fontSize: 11,
      fontWeight: "700",
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    loggedHeaderCompact: {
      marginTop: spacing.xs,
      gap: spacing.xs,
    },
    loggedCollapsedPreview: {
      marginTop: spacing.xs,
      flexDirection: "column",
      gap: 3,
    },
    loggedCollapsedPreviewRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingVertical: 2,
      borderBottomWidth: 1,
      borderBottomColor: `${colors.border}12`,
    },
    loggedCollapsedPreviewText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
      lineHeight: 13,
    },
    loggedCollapsedPreviewItem: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    loggedCollapsedPreviewMore: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginTop: 4,
    },
    loggedHeader: {
      marginBottom: spacing.xs,
      gap: 6,
    },
    loggedHeaderTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.xs,
    },
    loggedTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    loggedMeta: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    loggedHeaderMacros: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
    },
    loggedCollapsedBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    loggedCollapsedText: {
      flex: 1,
      minWidth: 0,
      fontSize: 12,
      fontWeight: "600",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    loggedRow: {
      flexDirection: "row",
      alignItems: "center",
      // Opaque so the row covers the swipe-to-delete action when closed.
      backgroundColor: colors.surface,
      // 12 between the icon keys so their 6px hit slops never overlap.
      gap: 12,
      paddingVertical: spacing.sm + 2,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    loggedMain: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm + 2,
    },
    loggedIconWrap: {
      width: 40,
      height: 40,
      borderRadius: radii.none,
      alignItems: "center",
      justifyContent: "center",
    },
    loggedInfo: { flex: 1, minWidth: 0 },
    loggedName: {
      fontSize: 15.5,
      color: colors.text,
      fontWeight: "600",
      lineHeight: 20,
      flexWrap: "wrap",
      flexShrink: 1,
    },
    loggedSubRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 4,
      marginTop: 2.5,
    },
    loggedSub: { fontSize: 12.5, color: colors.textMuted },
    miniChip: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: radii.none,
    },
    miniChipText: {
      fontSize: 11,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    budgetBar: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: `${colors.primary}0f`,
      borderRadius: radii.none,
      borderWidth: borders.width,
      borderColor: colors.primary,
      gap: spacing.sm,
    },
    budgetTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    budgetNumbers: {
      flex: 1,
      minWidth: 0,
    },
    budgetEyebrow: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    budgetKcal: {
      fontSize: 24,
      fontWeight: "800",
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      letterSpacing: 0.2,
      marginTop: 2,
    },
    budgetKcalGoal: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    dayBudgetBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.none,
      borderWidth: borders.width,
      flexShrink: 0,
      maxWidth: "44%",
    },
    dayBudgetBadgeText: {
      fontSize: 12,
      fontWeight: "800",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    budgetBarTrack: {
      height: 10,
      backgroundColor: colors.surface,
      borderRadius: radii.none,
      borderWidth: borders.width,
      borderColor: colors.border,
      overflow: "hidden",
      flexDirection: "row",
    },
    budgetBarFill: {
      height: "100%",
      borderRadius: radii.none,
      borderTopWidth: 1.5,
      borderTopColor: "rgba(255,255,255,0.22)",
    },
    budgetPillsRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    budgetMacrosLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    budgetHint: {
      fontSize: 11,
      fontWeight: "600",
      fontFamily: fonts.mono,
      color: colors.danger,
      letterSpacing: 0.3,
      textTransform: "uppercase",
    },
    loggedIconBtn: {
      width: 32,
      height: 32,
      borderRadius: radii.none,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: radii.none,
      borderWidth: borders.width,
      backgroundColor: colors.surfaceAlt,
    },
    emptyActionText: {
      fontSize: 11.5,
      fontWeight: "700",
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    searchAllFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginHorizontal: spacing.md,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: radii.none,
      borderWidth: borders.width,
      backgroundColor: colors.surfaceAlt,
    },
    searchAllFooterText: {
      fontSize: 11.5,
      fontWeight: "700",
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    filterStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      marginHorizontal: spacing.md,
      marginBottom: 6,
      backgroundColor: colors.surfaceAlt,
      borderWidth: borders.width,
      borderColor: colors.border,
      borderRadius: radii.none,
    },
    filterStatusLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flex: 1,
      minWidth: 0,
    },
    filterStatusText: {
      fontSize: 10.5,
      fontWeight: "700",
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      flex: 1,
    },
    filterStatusClear: {
      fontSize: 10.5,
      fontWeight: "800",
      fontFamily: fonts.mono,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      paddingLeft: 6,
    },
    reorderBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md + 4,
      paddingVertical: spacing.xs,
      marginBottom: spacing.xs,
    },
    reorderTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textMuted,
    },
    reorderBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radii.none,
      backgroundColor: colors.surfaceAlt,
      borderWidth: borders.width,
      borderColor: colors.border,
    },
    reorderBtnText: {
      fontSize: 12.5,
      fontWeight: "700",
      color: colors.text,
    },
  })
