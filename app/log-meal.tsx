import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  FlatList,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FoodListItem } from "@/components/FoodListItem"
import { SortableFavoriteList } from "@/components/SortableFavoriteList"
import { EmptyState } from "@/components/EmptyState"
import { OfflineBanner } from "@/components/OfflineBanner"
import { CreateOptionsModal } from "@/components/CreateOptionsModal"
import { useDebounce } from "@/hooks/useDebounce"
import { useFoodSearch } from "@/hooks/useFoodSearch"
import { useApp } from "@/context/AppContext"
import { useToast } from "@/context/ToastContext"
import { getFoodIcon } from "@/utils/food-icon"
import { getSuggestedFoods } from "@/services/yazio/foods"
import { getFavoriteFoods, getRecentFoodUsages, updateFavoriteOrder } from "@/db/food-cache"
import { deleteFoodEntry, getDiaryEntriesForDate, quickLogFood } from "@/services/diary"
import { listMeals, logMealToDiary, mealTotals } from "@/services/meals"
import type {
  DiaryEntry,
  FoodNutrients,
  Meal,
  MealType,
  RecentFoodUsage,
  SearchFoodResult,
} from "@/types"
import { mergeFoodResults } from "@/utils/food-search"
import { sumNutrients } from "@/utils/nutrients"
import { MEAL_LABELS, MEAL_ICONS } from "@/utils/meals"
import { displayUnit } from "@/utils/food-display"
import { formatNumber } from "@/utils/format"
import { confirmAction } from "@/utils/confirm"
import { formatDisplayDate, toDateKey } from "@/utils/date"
import { routeParam } from "@/utils/route"
import { useTheme } from "@/hooks/useTheme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { useSafeBack } from "@/hooks/useSafeBack"
import { ModalContainer } from "@/components/ModalContainer"
import { MealListItem } from "@/components/MealListItem"
import { MacroPills } from "@/components/MacroPills"
import { Fab } from "@/components/Fab"
import { FabCluster } from "@/components/FabCluster"
import { spacing, fonts, type ColorPalette } from "@/theme"
import { useLayout } from "@/hooks/useLayout"

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
  { id: "frequent", label: "Frequent", icon: "star", activeIcon: "star" },
  { id: "recent", label: "Recent", icon: "clock", activeIcon: "clock" },
  { id: "favorites", label: "Favorites", icon: "star", activeIcon: "star" },
  { id: "meals", label: "Meals", icon: "shopping-bag", activeIcon: "shopping-bag" },
]

const ZERO_TOTALS: FoodNutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

let rememberedCategory: FoodCategory = "foods"
let rememberedListMode: ListMode = "frequent"

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
  const { showError, showWarning, showSuccess, showUndo } = useToast()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const { width } = useLayout()
  const compact = width < 380
  const insets = useSafeAreaInsets()

  const accent = colors[mealType]

  const [category, setCategoryState] = useState<FoodCategory>(rememberedCategory)
  const [query, setQuery] = useState("")
  const searchInputRef = useRef<TextInput>(null)
  const debounced = useDebounce(query, 200)
  const [listMode, setListModeState] = useState<ListMode>(rememberedListMode)
  const [meals, setMeals] = useState<Meal[]>([])
  const [loggingMealId, setLoggingMealId] = useState<string | null>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [reorderFavorites, setReorderFavorites] = useState(false)

  const setCategory = useCallback((cat: FoodCategory) => {
    rememberedCategory = cat
    setCategoryState(cat)
  }, [])

  const setListMode = useCallback((mode: ListMode) => {
    rememberedListMode = mode
    setListModeState(mode)
  }, [])

  const activeTab: ActiveTab = category === "meals" ? "meals" : listMode

  const handleTabPress = useCallback(
    (tabId: ActiveTab) => {
      if (tabId === "meals") {
        setCategory("meals")
      } else {
        setCategory("foods")
        setListMode(tabId)
      }
    },
    [setCategory, setListMode],
  )
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
      const timer = setTimeout(() => setBudgetBadgeFlash(false), 450)
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

  const emptyQuery = useCallback(async () => {
    if (listMode === "favorites") return getFavoriteFoods()
    if (listMode === "recent") return getRecentFoodUsages(20)
    // Frequent list: local picks first, YAZIO's suggestions patch in when ready.
    const [favorites, usages] = await Promise.all([getFavoriteFoods(), getRecentFoodUsages(20)])
    return mergeFoodResults(mergeFoodResults(suggestions, favorites), usageFoods(usages))
  }, [listMode, suggestions])

  // Keep the current recents/favorites list rendered below search results
  // instead of replacing it the moment the user types.
  // Reset synchronously when the query clears. Render-adjustment pattern.
  const [prevDebounced, setPrevDebounced] = useState(debounced)
  const [contextual, setContextual] = useState<FoodRow[]>([])
  if (prevDebounced !== debounced) {
    setPrevDebounced(debounced)
    if (!debounced.trim()) setContextual([])
  }
  useEffect(() => {
    if (!debounced.trim()) return
    let cancelled = false
    emptyQuery()
      .then((items) => {
        if (!cancelled) setContextual(items)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [debounced, emptyQuery])

  const handleSearchError = useCallback(
    (error: unknown) => showError(error, "Could not load foods."),
    [showError],
  )

  const { foods, loading, refresh } = useFoodSearch<FoodRow>(debounced, {
    enabled: category === "foods",
    emptyQuery,
    onError: handleSearchError,
  })

  const loadMeals = useCallback(async () => {
    try {
      setMeals(await listMeals())
    } catch (error) {
      showError(error, "Could not load meals.")
    }
  }, [showError])

  // Refetch favorites/recent/meals/logged entries when returning from add-food or meal-builder.
  useFocusEffect(
    useCallback(() => {
      loadLoggedEntries()
      if (category === "meals") {
        loadMeals()
      } else if (!debounced.trim() && listMode !== "frequent") {
        refresh()
      } else if (debounced.trim()) {
        emptyQuery()
          .then(setContextual)
          .catch(() => undefined)
      }
    }, [category, debounced, emptyQuery, listMode, loadLoggedEntries, loadMeals, refresh]),
  )

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
        // Receipt with an exit. Every silent write gets a named undo.
        // No refresh here. The foods list stays live underneath the
        // logged section, so re-querying favorites or recents would flash the
        // whole FlatList and push the search field down on every tap.
        showUndo(`${food.name} added · ${Math.round(entry.kcal)} kcal`, () => {
          deleteFoodEntry(entry.id)
            .then(() => {
              void loadLoggedEntries()
            })
            .catch(() => undefined)
        })
      } catch (error) {
        showError(error, "Could not add food.")
      } finally {
        setAddingKey(null)
      }
    },
    [addingKey, date, loadLoggedEntries, mealType, showError, showUndo],
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

  const handleReorderFavorites = useCallback(
    async (reordered: SearchFoodResult[]) => {
      const orderedIds = reordered.map((f) => f.product_id)
      await updateFavoriteOrder(orderedIds)
      refresh()
    },
    [refresh],
  )

  const moveFavorite = useCallback(
    async (index: number, direction: -1 | 1) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= foods.length) return
      const currentList = [...foods]
      const [item] = currentList.splice(index, 1)
      currentList.splice(targetIndex, 0, item)
      const orderedIds = currentList.map((f) => (isUsageRow(f) ? f.food.product_id : f.product_id))
      await updateFavoriteOrder(orderedIds)
      refresh()
    },
    [foods, refresh],
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
            canMoveDown={index < foods.length - 1}
            onMoveUp={() => moveFavorite(index, -1)}
            onMoveDown={() => moveFavorite(index, 1)}
          />
        )
      }
      return (
        <FoodListItem
          food={item}
          accentColor={accent}
          quickAddVariant="pill"
          onPress={() => openFood(item)}
          onQuickAdd={() => handleQuickAdd(item)}
          quickAdding={addingKey === item.product_id}
          isReordering={isReordering}
          canMoveUp={index > 0}
          canMoveDown={index < foods.length - 1}
          onMoveUp={() => moveFavorite(index, -1)}
          onMoveDown={() => moveFavorite(index, 1)}
        />
      )
    },
    [
      accent,
      addingKey,
      category,
      debounced,
      foods.length,
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

  // Meals are stored locally. The query filters them by name so the search
  // box stays useful when browsing the "Meals" category.
  const filteredMeals = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    if (!q) return meals
    return meals.filter((meal) => meal.name.toLowerCase().includes(q))
  }, [debounced, meals])

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
          logging={loggingMealId === item.id}
          accentColor={accent}
        />
      )
    },
    [accent, handleLogMeal, loggingMealId, mealTotalsById, router],
  )

  const emptyMessage = useMemo(() => {
    if (category === "meals") {
      if (debounced.trim()) return "No meals match your search."
      return "No meals yet. Create one to see it here."
    }
    if (debounced.trim()) return "No foods found. Try a different search."
    if (listMode === "favorites") return "No favorites yet. Star foods to see them here."
    if (listMode === "recent") return "No recent foods yet. Log something to see it here."
    return "Search or scan to log food."
  }, [category, debounced, listMode])

  const loggedSection =
    loggedEntries.length > 0 ? (
      <View style={styles.loggedWrapCompact}>
        <Pressable
          style={styles.loggedCollapsedBarCompact}
          onPress={() => {
            if (debounced.trim()) {
              setLoggedOpenQuery(isLoggedExpanded ? null : debounced)
            } else {
              setLoggedExpanded((v) => !v)
            }
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded: isLoggedExpanded }}
          accessibilityLabel={`${isLoggedExpanded ? "Hide" : "Show"} ${loggedEntries.length} ${
            loggedEntries.length === 1 ? "item" : "items"
          } logged in ${MEAL_LABELS[mealType]}, ${mealKcal} kcal`}
        >
          <Feather
            name={isLoggedExpanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={colors.textMuted}
          />
          <Text style={styles.loggedCollapsedTextCompact}>
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
                <View key={entry.id} style={styles.loggedRow}>
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
                          {formatNumber(entry.amount)} {displayUnit(entry.unit)} ·{" "}
                          {Math.round(entry.kcal)} kcal
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
                    hitSlop={6}
                    accessibilityRole="button"
                    // "details" disambiguates from the row's own edit action.
                    accessibilityLabel={`Edit ${entry.food_name} details`}
                  >
                    <Feather name="edit-2" size={16} color={accent} />
                  </Pressable>
                  <Pressable
                    style={[styles.loggedIconBtn, { backgroundColor: `${colors.danger}1a` }]}
                    onPress={() => onDeleteEntry(entry)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${entry.food_name}`}
                  >
                    <Feather name="trash-2" size={16} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    ) : null

  const favoritesToolbar =
    category === "foods" && listMode === "favorites" && !debounced.trim() && foods.length > 1 ? (
      <View style={styles.reorderBar}>
        <Text style={styles.reorderTitle}>
          {foods.length} {foods.length === 1 ? "Favorite" : "Favorites"}
        </Text>
        <Pressable
          style={[
            styles.reorderBtn,
            reorderFavorites && { backgroundColor: accent, borderColor: accent },
          ]}
          onPress={() => setReorderFavorites((v) => !v)}
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ModalContainer surface>
        {/* Compact Merged Header: Meal Icon + Title + Kcal + 3-Dot More Menu */}
        <View
          style={[
            styles.header,
            { paddingTop: insets.top > 0 ? insets.top + spacing.xs : spacing.sm },
          ]}
        >
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

        {/* Macros Left to Fill and Day Budget Bar */}
        <View style={styles.budgetBar}>
          <View style={styles.budgetTopRow}>
            <Text style={styles.budgetSectionLabel}>Left to fill today</Text>

            {settings.calorie_goal > 0 ? (
              <View style={styles.dayBudgetBadgeWrap}>
                <View
                  style={[
                    styles.dayBudgetBadge,
                    {
                      backgroundColor: budgetBadgeFlash
                        ? dayOverKcal > 0
                          ? colors.danger
                          : colors.primary
                        : dayOverKcal > 0
                          ? `${colors.danger}18`
                          : `${colors.primary}18`,
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
                      ? `+${Math.round(dayOverKcal)} kcal over`
                      : `${Math.round(dayRemainingKcal)} kcal left`}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.budgetPillsRow}>
            <MacroPills
              protein={dayProteinRemaining}
              carbs={dayCarbsRemaining}
              fat={dayFatRemaining}
              size="xs"
            />
          </View>
        </View>

        {/* Logged in this meal. Lives under the budget bar, not inside the
            FlatList header, so adding a food does not push the search field
            and tabs down. Fixed max height with internal scroll keeps the
            outer layout stable. */}
        {loggedSection ? <View style={styles.loggedSectionWrap}>{loggedSection}</View> : null}

        {/* Always visible quick-switch tabs: Frequent, Recent, Favorites, Meals */}
        <View style={styles.tabBar} accessibilityRole="tablist">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <Pressable
                key={tab.id}
                onPress={() => handleTabPress(tab.id)}
                style={[
                  styles.tabItem,
                  isActive
                    ? [
                        styles.tabItemActive,
                        {
                          backgroundColor: `${accent}1f`,
                          borderColor: `${accent}55`,
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

        {/* Search Bar: always visible. Search is the core verb of this
            screen, so it never hides behind a toggle FAB. */}
        <View style={styles.searchWrap}>
          <View style={styles.searchIconBox}>
            <Feather name="search" size={14} color={colors.text} />
          </View>
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { borderColor: accent }]}
            placeholder={category === "meals" ? "Search meals…" : "Search foods…"}
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
            enterKeyHint="search"
            onSubmitEditing={() => searchInputRef.current?.blur()}
            accessibilityLabel="Search foods"
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

        <OfflineBanner visible={!yazioAvailable && debounced.length > 0} />

        {loading && foods.length === 0 ? (
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
                  {favoritesToolbar}
                  <SortableFavoriteList
                    foods={foods as SearchFoodResult[]}
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
              data={foods}
              keyExtractor={(item) =>
                isUsageRow(item) ? `${item.food.product_id}-${item.amount}` : item.product_id
              }
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              contentContainerClassName={
                foods.length === 0 && !loading ? "grow justify-center" : "pt-1 pb-36"
              }
              ListHeaderComponent={favoritesToolbar}
              renderItem={renderFood}
              ListEmptyComponent={
                !loading ? (
                  <EmptyState
                    icon="shopping-bag"
                    iconColor={accent}
                    title={emptyMessage}
                    variant="compact"
                  />
                ) : null
              }
              ListFooterComponent={
                debounced && contextual.length > 0 ? (
                  <View style={styles.contextualWrap}>
                    <Text style={styles.contextualTitle}>
                      {listMode === "favorites"
                        ? "Favorite picks"
                        : listMode === "recent"
                          ? "Recently used"
                          : "Frequent picks"}
                    </Text>
                    {contextual.map((item) =>
                      isUsageRow(item) ? (
                        <FoodListItem
                          key={`${item.food.product_id}-${item.amount}`}
                          food={item.food}
                          amount={item.amount}
                          accentColor={accent}
                          quickAddVariant="pill"
                          onPress={() => openFood(item.food)}
                          onQuickAdd={() => handleQuickAdd(item.food, item.amount)}
                          quickAdding={addingKey === `${item.food.product_id}:${item.amount}`}
                        />
                      ) : (
                        <FoodListItem
                          key={item.product_id}
                          food={item}
                          accentColor={accent}
                          quickAddVariant="pill"
                          onPress={() => openFood(item)}
                          onQuickAdd={() => handleQuickAdd(item)}
                          quickAdding={addingKey === item.product_id}
                        />
                      ),
                    )}
                  </View>
                ) : undefined
              }
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
              filteredMeals.length === 0 && !loading ? "grow justify-center" : "pb-36"
            }
            ListHeaderComponent={
              <Pressable
                style={styles.newMealBtn}
                onPress={() => router.push({ pathname: "/meal-builder" })}
                accessibilityRole="button"
                accessibilityLabel="Create a new meal"
              >
                <Feather name="shopping-bag" size={20} color={colors.onPrimary} />
                <Text style={styles.newMealText}>New meal</Text>
              </Pressable>
            }
            renderItem={renderMeal}
            ListEmptyComponent={
              !loading ? (
                <EmptyState
                  icon="shopping-bag"
                  iconColor={accent}
                  title={emptyMessage}
                  variant="compact"
                />
              ) : null
            }
          />
        )}
      </ModalContainer>

      <FabCluster
        bottomOffset={insets.bottom + (compact ? 12 : 16)}
        insetX={compact ? 12 : 20}
        left={
          <Fab
            size={compact ? "sm" : "md"}
            icon="arrow-left"
            tone="surface"
            onPress={safeBack}
            accessibilityLabel="Go back"
          />
        }
        right={
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Fab
              size={compact ? "sm" : "md"}
              icon="search"
              tone="surface"
              onPress={() => searchInputRef.current?.focus()}
              accessibilityLabel="Search foods"
            />
            <Fab
              size={compact ? "sm" : "md"}
              // MaterialCommunityIcons "barcode-scan": the only glyph that
              // reads as scanning at a glance.
              icon="barcode-scan"
              IconComponent={MaterialCommunityIcons}
              onPress={() => router.push({ pathname: "/scan", params: { meal: mealType, date } })}
              accessibilityLabel="Scan barcode"
            />
          </View>
        }
      />

      <CreateOptionsModal
        visible={optionsOpen}
        mealType={mealType}
        date={date}
        onClose={() => setOptionsOpen(false)}
      />
    </KeyboardAvoidingView>
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
      borderRadius: 0,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.sm,
    },
    mealIconBox: {
      width: 28,
      height: 28,
      borderRadius: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 19,
      fontWeight: "800",
      color: colors.text,
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
      fontWeight: "500",
      color: colors.textMuted,
    },
    moreBtn: {
      width: 36,
      height: 36,
      borderRadius: 0,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    tabBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginHorizontal: spacing.sm + 4,
      marginBottom: spacing.xs,
    },
    tabItem: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingVertical: 6,
      paddingHorizontal: 2,
      borderRadius: 0,
      borderWidth: 1,
    },
    tabItemActive: {},
    tabItemInactive: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    tabLabel: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.01,
    },
    tabLabelActive: {
      fontWeight: "700",
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: spacing.md,
      marginBottom: spacing.xs,
      gap: 6,
    },
    searchIconBox: {
      position: "absolute",
      left: 6,
      width: 28,
      height: 28,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 0,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
    },
    searchInput: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 0,
      borderWidth: 1.5,
      paddingVertical: spacing.sm,
      paddingLeft: 40,
      paddingRight: spacing.xl,
      fontSize: 15,
      color: colors.text,
    },
    // 28x28 visual, hitSlop 10 brings the effective target to 48px.
    searchClear: {
      position: "absolute",
      right: spacing.md - 4,
      zIndex: 1,
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 0,
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
      borderRadius: 0,
      backgroundColor: colors.primary,
    },
    newMealText: { color: colors.onPrimary, fontWeight: "700", fontSize: 16 },
    loggedSectionWrap: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      maxHeight: 260,
      borderRadius: 0,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: "hidden",
    },
    loggedWrap: {
      padding: spacing.md,
      borderRadius: 0,
      backgroundColor: colors.surface,
      maxHeight: 260,
    },
    loggedList: {
      maxHeight: 160,
      gap: 0,
    },
    loggedWrapCompact: {
      padding: spacing.sm,
      borderRadius: 0,
      backgroundColor: colors.surface,
    },
    loggedCollapsedBarCompact: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    loggedCollapsedTextCompact: {
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
      fontSize: 10,
      fontWeight: "600",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
      lineHeight: 13,
    },
    loggedCollapsedPreviewItem: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    loggedCollapsedPreviewMore: {
      fontSize: 10,
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
      borderRadius: 0,
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
      borderRadius: 0,
    },
    miniChipText: {
      fontSize: 11,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    budgetBar: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 0,
      borderWidth: 1.5,
      borderColor: colors.border,
      gap: 6,
    },
    budgetTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    budgetSectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    dayBudgetBadgeWrap: {
      flexDirection: "row",
      alignItems: "center",
    },
    dayBudgetBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 0,
    },
    dayBudgetBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    budgetPillsRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
    },
    loggedIconBtn: {
      width: 32,
      height: 32,
      borderRadius: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    contextualWrap: {
      paddingTop: spacing.md,
      marginHorizontal: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    contextualTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textMuted,
      marginBottom: spacing.xs,
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
      fontSize: 13,
      fontWeight: "700",
      color: colors.textMuted,
    },
    reorderBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 0,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    reorderBtnText: {
      fontSize: 12.5,
      fontWeight: "700",
      color: colors.text,
    },
  })
