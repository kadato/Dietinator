import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FoodListItem } from "@/components/FoodListItem"
import { EmptyState } from "@/components/EmptyState"
import { FilterDropdown, type DropdownOption } from "@/components/FilterDropdown"
import { OfflineBanner } from "@/components/OfflineBanner"
import { useDebounce } from "@/hooks/useDebounce"
import { useFoodSearch } from "@/hooks/useFoodSearch"
import { useApp } from "@/context/AppContext"
import { useToast } from "@/context/ToastContext"
import { getFoodIcon } from "@/utils/food-icon"
import { getSuggestedFoods } from "@/services/yazio/foods"
import { getFavoriteFoods, getRecentFoodUsages } from "@/db/food-cache"
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
import { spacing, type ColorPalette } from "@/theme"

type FoodCategory = "foods" | "meals"
type ListMode = "frequent" | "recent" | "favorites"

const CATEGORY_OPTIONS: DropdownOption<FoodCategory>[] = [
  { value: "foods", label: "Foods", icon: "nutrition-outline" },
  { value: "meals", label: "Meals", icon: "restaurant-outline" },
]

const ZERO_TOTALS: FoodNutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

const LIST_MODE_OPTIONS: DropdownOption<ListMode>[] = [
  { value: "frequent", label: "Frequent", icon: "sparkles-outline" },
  { value: "recent", label: "Recent", icon: "time-outline" },
  { value: "favorites", label: "Favorites", icon: "star-outline" },
]

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
  const { showError, showWarning, showSuccess } = useToast()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()

  const accent = colors[mealType]

  const [category, setCategoryState] = useState<FoodCategory>(rememberedCategory)
  const [query, setQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(true)
  const searchInputRef = useRef<TextInput>(null)
  const debounced = useDebounce(query, 200)
  const [listMode, setListModeState] = useState<ListMode>(rememberedListMode)
  const [meals, setMeals] = useState<Meal[]>([])
  const [loggingMealId, setLoggingMealId] = useState<string | null>(null)

  const setCategory = useCallback((cat: FoodCategory) => {
    rememberedCategory = cat
    setCategoryState(cat)
  }, [])

  const setListMode = useCallback((mode: ListMode) => {
    rememberedListMode = mode
    setListModeState(mode)
  }, [])
  // YAZIO's suggestions for this meal slot arrive async and patch into the
  // "Frequent" list — the local favorites/recents render instantly instead of
  // waiting on the network.
  const [suggestions, setSuggestions] = useState<SearchFoodResult[]>([])
  const [dayEntries, setDayEntries] = useState<DiaryEntry[]>([])
  const [loggedEntries, setLoggedEntries] = useState<DiaryEntry[]>([])
  // Quick-add in-flight row key (product id, or product id + amount).
  const [addingKey, setAddingKey] = useState<string | null>(null)

  const handleToggleSearch = useCallback(() => {
    setSearchOpen(true)
    setTimeout(() => {
      searchInputRef.current?.focus()
    }, 50)
  }, [])

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
  // Reset synchronously when the query clears (render-adjustment pattern).
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
      const key = amount != null ? `${food.product_id}:${amount}` : food.product_id
      if (addingKey === key) return
      setAddingKey(key)
      try {
        await quickLogFood({
          date,
          mealType,
          food,
          amount,
        })
        await loadLoggedEntries()
        refresh()
      } catch (error) {
        showError(error, "Could not add food.")
      } finally {
        setAddingKey(null)
      }
    },
    [addingKey, date, loadLoggedEntries, mealType, refresh, showError],
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
        }
        if (skipped.length > 0) {
          showWarning(
            `Could not log: ${skipped.join(", ")}. Check your connection and try again.`,
            "Some items skipped",
          )
        }
        router.dismissAll()
      } catch (error) {
        showError(error, "Could not log this meal.")
      } finally {
        setLoggingMealId(null)
      }
    },
    [date, loggingMealId, mealType, router, showError, showSuccess, showWarning],
  )

  const renderFood = useCallback(
    ({ item }: { item: FoodRow }) => {
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
        />
      )
    },
    [accent, addingKey, handleQuickAdd, openFood],
  )

  const mealTotalsById = useMemo(() => {
    const map = new Map<string, FoodNutrients>()
    for (const meal of meals) map.set(meal.id, mealTotals(meal))
    return map
  }, [meals])

  // Meals are stored locally — the query filters them by name so the search
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
          onPress={() => handleLogMeal(item)}
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
    category === "foods" && loggedEntries.length > 0 ? (
      <View style={styles.loggedWrap}>
        <View style={styles.loggedHeader}>
          <Text style={styles.loggedTitle}>Logged in {MEAL_LABELS[mealType]}</Text>
          <View style={styles.loggedMetaRow}>
            <Text style={styles.loggedMeta}>
              {loggedEntries.length} items · {mealKcal} kcal
            </Text>
            <MacroPills
              protein={mealTotalsValues.protein}
              carbs={mealTotalsValues.carbs}
              fat={mealTotalsValues.fat}
              size="xs"
            />
          </View>
        </View>
        {loggedEntries.map((entry) => (
          <View key={entry.id} style={styles.loggedRow}>
            <Pressable
              style={styles.loggedMain}
              onPress={() => openEdit(entry)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${entry.food_name}`}
            >
              <View style={[styles.loggedIconWrap, { backgroundColor: `${accent}18` }]}>
                <MaterialCommunityIcons
                  name={getFoodIcon(entry.food_name, entry)}
                  size={20}
                  color={accent}
                />
              </View>
              <View style={styles.loggedInfo}>
                <Text style={styles.loggedName} numberOfLines={2}>
                  {entry.food_name}
                </Text>
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
              accessibilityLabel={`Edit ${entry.food_name}`}
            >
              <Ionicons name="create-outline" size={16} color={accent} />
            </Pressable>
            <Pressable
              style={[styles.loggedIconBtn, { backgroundColor: `${colors.danger}1a` }]}
              onPress={() => onDeleteEntry(entry)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${entry.food_name}`}
            >
              <Ionicons name="trash" size={16} color={colors.danger} />
            </Pressable>
          </View>
        ))}
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
              <Ionicons name={MEAL_ICONS[mealType]} size={18} color={accent} />
            </View>
            <Text style={styles.title}>{MEAL_LABELS[mealType]}</Text>
            <Text style={styles.headerKcal}>
              {mealKcal} <Text style={styles.headerUnit}>kcal</Text>
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.push({ pathname: "/create-options", params: { meal: mealType, date } })
            }
            hitSlop={8}
            style={styles.moreBtn}
            accessibilityRole="button"
            accessibilityLabel="More"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
          </Pressable>
        </View>

        {/* Macros Left to Fill & Day Budget Bar */}
        <View style={styles.budgetBar}>
          <View style={styles.budgetTopRow}>
            <Text style={styles.budgetSectionLabel}>Left to fill today</Text>

            {settings.calorie_goal > 0 ? (
              <View style={styles.dayBudgetBadgeWrap}>
                <View
                  style={[
                    styles.dayBudgetBadge,
                    {
                      backgroundColor:
                        dayOverKcal > 0 ? `${colors.danger}18` : `${colors.primary}18`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayBudgetBadgeText,
                      { color: dayOverKcal > 0 ? colors.danger : colors.primary },
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

        {/* Compact Filter Row: Dropdowns for Type & Mode */}
        <View style={styles.filterRow}>
          <FilterDropdown<FoodCategory>
            value={category}
            options={CATEGORY_OPTIONS}
            onChange={setCategory}
            title="Select Type"
            accentColor={accent}
          />
          {category === "foods" && !debounced.trim() ? (
            <FilterDropdown<ListMode>
              value={listMode}
              options={LIST_MODE_OPTIONS}
              onChange={setListMode}
              title="Filter Foods"
              accentColor={accent}
            />
          ) : null}
        </View>

        {/* Search Bar (Expandable / Focusable via Search FAB) */}
        {searchOpen || query.length > 0 ? (
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={17} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={[styles.searchInput, { borderColor: accent }]}
              placeholder={category === "meals" ? "Search meals…" : "Search foods…"}
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => searchInputRef.current?.blur()}
              accessibilityLabel="Search foods"
            />
            {query.length > 0 ? (
              <Pressable
                style={styles.searchClear}
                onPress={() => setQuery("")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : (
              <Pressable
                style={styles.searchClear}
                onPress={() => setSearchOpen(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Collapse search"
              >
                <Ionicons name="chevron-up-circle-outline" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        ) : null}

        <OfflineBanner visible={!yazioAvailable && debounced.length > 0} />

        {loading ? <ActivityIndicator style={styles.loader} color={accent} /> : null}

        {category === "foods" ? (
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
            ListHeaderComponent={loggedSection}
            renderItem={renderFood}
            ListEmptyComponent={
              !loading ? (
                <EmptyState
                  icon="fast-food-outline"
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
                <Ionicons name="restaurant" size={20} color={colors.onPrimary} />
                <Text style={styles.newMealText}>New meal</Text>
              </Pressable>
            }
            renderItem={renderMeal}
            ListEmptyComponent={
              !loading ? (
                <EmptyState
                  icon="restaurant-outline"
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
        bottomOffset={insets.bottom + 20}
        left={<Fab tone="surface" icon="close" onPress={safeBack} accessibilityLabel="Cancel" />}
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Fab
              tone={searchOpen ? "primary" : "surface"}
              icon="search"
              onPress={handleToggleSearch}
              accessibilityLabel="Search"
            />
            <Fab
              icon="barcode-outline"
              onPress={() => router.push({ pathname: "/scan", params: { meal: mealType, date } })}
              accessibilityLabel="Scan barcode"
            />
          </View>
        }
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
    mealIconBox: {
      width: 28,
      height: 28,
      borderRadius: 9,
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
      borderRadius: 18,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    filterRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 8,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xs,
      paddingBottom: spacing.xs,
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: spacing.md,
      marginBottom: spacing.xs,
    },
    searchIcon: { position: "absolute", left: spacing.md, zIndex: 1 },
    searchInput: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: spacing.sm,
      paddingLeft: spacing.xl + 6,
      paddingRight: spacing.xl,
      fontSize: 15,
      color: colors.text,
    },
    searchClear: { position: "absolute", right: spacing.md, zIndex: 1 },
    loader: { marginVertical: spacing.sm },
    list: { flex: 1 },
    newMealBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    newMealText: { color: colors.onPrimary, fontWeight: "700", fontSize: 16 },
    loggedWrap: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    loggedHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    loggedTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    loggedMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    loggedMeta: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
    loggedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
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
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    loggedInfo: { flex: 1, minWidth: 0 },
    loggedName: { fontSize: 15.5, color: colors.text, fontWeight: "600", lineHeight: 20 },
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
      borderRadius: 6,
    },
    miniChipText: {
      fontSize: 11,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    budgetBar: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 16,
      borderWidth: 1,
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
      borderRadius: 7,
    },
    dayBudgetBadgeText: {
      fontSize: 11,
      fontWeight: "700",
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
      borderRadius: 16,
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
  })
