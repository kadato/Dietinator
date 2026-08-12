import { useCallback, useEffect, useMemo, useState } from "react"
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
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FoodListItem } from "@/components/FoodListItem"
import { EmptyState } from "@/components/EmptyState"
import { SegmentedControl } from "@/components/SegmentedControl"
import { OfflineBanner } from "@/components/OfflineBanner"
import { useDebounce } from "@/hooks/useDebounce"
import { useFoodSearch } from "@/hooks/useFoodSearch"
import { useApp } from "@/context/AppContext"
import { useToast } from "@/context/ToastContext"
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
import { MEAL_LABELS } from "@/utils/meals"
import { displayUnit, formatServingOption, formatUsageAmountLine } from "@/utils/food-display"
import { confirmAction } from "@/utils/confirm"
import { formatDisplayDate, toDateKey } from "@/utils/date"
import { routeParam } from "@/utils/route"
import { useTheme } from "@/hooks/useTheme"
import { useThemedStyles } from "@/hooks/useThemedStyles"
import { ModalContainer } from "@/components/ModalContainer"
import { spacing, type ColorPalette } from "@/theme"

type FoodCategory = "foods" | "meals"
type ListMode = "frequent" | "recent" | "favorites"

const CATEGORY_OPTIONS: { value: FoodCategory; label: string }[] = [
  { value: "foods", label: "Foods" },
  { value: "meals", label: "Meals" },
]

const ZERO_TOTALS: FoodNutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

const LIST_MODE_OPTIONS: { value: ListMode; label: string }[] = [
  { value: "frequent", label: "Frequent" },
  { value: "recent", label: "Recent" },
  { value: "favorites", label: "Favorites" },
]

function foodSubtitle(food: SearchFoodResult): string {
  const unit = food.base_unit || "g"
  const producer = food.producer?.trim()
  const serving = formatServingOption(food.serving, unit)
  return producer ? `${producer}, ${serving}` : serving
}

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
  const params = useLocalSearchParams<{ meal?: string; date?: string }>()
  const mealType = (routeParam(params.meal) ?? "lunch") as MealType
  const date = routeParam(params.date) ?? toDateKey()
  const { yazioAvailable } = useApp()
  const { showError, showWarning, showSuccess } = useToast()
  const { colors } = useTheme()
  const styles = useThemedStyles(createStyles)
  const insets = useSafeAreaInsets()

  const safeBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace("/(tabs)")
    }
  }, [router])

  const accent = colors[mealType]

  const [category, setCategory] = useState<FoodCategory>("foods")
  const [query, setQuery] = useState("")
  const debounced = useDebounce(query, 200)
  const [listMode, setListMode] = useState<ListMode>("frequent")
  const [meals, setMeals] = useState<Meal[]>([])
  const [loggingMealId, setLoggingMealId] = useState<string | null>(null)
  // YAZIO's suggestions for this meal slot arrive async and patch into the
  // "Frequent" list — the local favorites/recents render instantly instead of
  // waiting on the network.
  const [suggestions, setSuggestions] = useState<SearchFoodResult[]>([])
  const [loggedEntries, setLoggedEntries] = useState<DiaryEntry[]>([])
  // Quick-add in-flight row key (product id, or product id + amount).
  const [addingKey, setAddingKey] = useState<string | null>(null)

  const loadLoggedEntries = useCallback(async () => {
    try {
      const entries = await getDiaryEntriesForDate(date, { remote: false })
      setLoggedEntries(entries.filter((entry) => entry.meal_type === mealType))
    } catch {
      setLoggedEntries([])
    }
  }, [date, mealType])

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

  const subtitles = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of foods) {
      if (!isUsageRow(item)) map.set(item.product_id, foodSubtitle(item))
    }
    return map
  }, [foods])

  const renderFood = useCallback(
    ({ item }: { item: FoodRow }) => {
      if (isUsageRow(item)) {
        return (
          <FoodListItem
            food={item.food}
            subtitle={formatUsageAmountLine(item.food, item.amount)}
            accentColor={accent}
            showKcal
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
          subtitle={subtitles.get(item.product_id)}
          accentColor={accent}
          showKcal
          quickAddVariant="pill"
          onPress={() => openFood(item)}
          onQuickAdd={() => handleQuickAdd(item)}
          quickAdding={addingKey === item.product_id}
        />
      )
    },
    [accent, addingKey, handleQuickAdd, openFood, subtitles],
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
        <View style={styles.mealRow}>
          <Pressable
            style={styles.mealMainTap}
            onPress={() => handleLogMeal(item)}
            disabled={loggingMealId === item.id}
            accessibilityRole="button"
            accessibilityLabel={`Log ${item.name}`}
          >
            <View style={[styles.mealIcon, { backgroundColor: `${accent}22` }]}>
              <Ionicons name="restaurant-outline" size={22} color={accent} />
            </View>
            <View style={styles.mealInfo}>
              <Text style={styles.mealName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.mealMeta} numberOfLines={1}>
                {item.items.length === 1
                  ? `1 food · ${Math.round(totals.kcal)} Cal`
                  : `${item.items.length} foods · ${Math.round(totals.kcal)} Cal`}
              </Text>
            </View>
          </Pressable>
          <Pressable
            style={styles.mealEditBtn}
            onPress={() =>
              router.push({
                pathname: "/meal-builder",
                params: { mealId: item.id },
              })
            }
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
          >
            <Ionicons name="create-outline" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[styles.mealLogBtn, { backgroundColor: accent }]}
            onPress={() => handleLogMeal(item)}
            disabled={loggingMealId === item.id}
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.name} to diary`}
          >
            {loggingMealId === item.id ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Ionicons name="add" size={22} color={colors.onPrimary} />
            )}
          </Pressable>
        </View>
      )
    },
    [accent, colors, handleLogMeal, loggingMealId, mealTotalsById, router, styles],
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
          <Text style={styles.loggedMeta}>
            {loggedEntries.length} · {Math.round(sumNutrients(loggedEntries).kcal)} Cal
          </Text>
        </View>
        {loggedEntries.map((entry) => (
          <View key={entry.id} style={styles.loggedRow}>
            <Pressable
              style={styles.loggedMain}
              onPress={() => openEdit(entry)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${entry.food_name}`}
            >
              <View style={styles.loggedInfo}>
                <Text style={styles.loggedName} numberOfLines={1}>
                  {entry.food_name}
                </Text>
                <Text style={styles.loggedSub} numberOfLines={1}>
                  {entry.amount} {displayUnit(entry.unit)} · {Math.round(entry.kcal)} Cal
                </Text>
              </View>
            </Pressable>
            <Pressable
              style={styles.loggedIconBtn}
              onPress={() => openEdit(entry)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${entry.food_name}`}
            >
              <Ionicons name="create-outline" size={18} color={colors.textMuted} />
            </Pressable>
            <Pressable
              style={styles.loggedIconBtn}
              onPress={() => onDeleteEntry(entry)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${entry.food_name}`}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
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
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Pressable
            style={styles.headerIconBtn}
            onPress={safeBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
          <Text style={styles.title}>{MEAL_LABELS[mealType]}</Text>
          <View style={styles.headerActions}>
            <Pressable
              style={[styles.headerIconBtn, styles.scanBtn, { backgroundColor: `${accent}1a` }]}
              onPress={() => router.push({ pathname: "/scan", params: { meal: mealType, date } })}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Scan"
            >
              <Ionicons name="barcode-outline" size={26} color={accent} />
            </Pressable>
            <Pressable
              style={styles.headerIconBtn}
              onPress={() =>
                router.push({ pathname: "/create-options", params: { meal: mealType, date } })
              }
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="More"
            >
              <Ionicons name="ellipsis-horizontal" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { borderColor: accent }]}
            placeholder={category === "meals" ? "Search meals…" : "Search foods…"}
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
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
          ) : null}
        </View>

        <View style={styles.filters}>
          <SegmentedControl<FoodCategory>
            value={category}
            options={CATEGORY_OPTIONS}
            onChange={setCategory}
            accentColor={accent}
          />
        </View>

        {category === "foods" && !debounced.trim() ? (
          <View style={styles.listModeRow}>
            <SegmentedControl<ListMode>
              value={listMode}
              options={LIST_MODE_OPTIONS}
              onChange={setListMode}
              accentColor={accent}
            />
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
            keyboardShouldPersistTaps="handled"
            contentContainerClassName={
              foods.length === 0 && !loading ? "grow justify-center" : "pt-1 pb-24"
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
                        subtitle={formatUsageAmountLine(item.food, item.amount)}
                        accentColor={accent}
                        showKcal
                        quickAddVariant="pill"
                        onPress={() => openFood(item.food)}
                        onQuickAdd={() => handleQuickAdd(item.food, item.amount)}
                        quickAdding={addingKey === `${item.food.product_id}:${item.amount}`}
                      />
                    ) : (
                      <FoodListItem
                        key={item.product_id}
                        food={item}
                        subtitle={subtitles.get(item.product_id)}
                        accentColor={accent}
                        showKcal
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
            keyboardShouldPersistTaps="handled"
            contentContainerClassName={
              filteredMeals.length === 0 && !loading ? "grow justify-center" : "pb-24"
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
    </KeyboardAvoidingView>
  )
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    headerIconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    scanBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    title: {
      flex: 1,
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    searchIcon: { position: "absolute", left: spacing.md + 10, zIndex: 1 },
    searchInput: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 2,
      paddingVertical: spacing.md,
      paddingLeft: spacing.xl + spacing.md,
      paddingRight: spacing.xl,
      fontSize: 16,
      color: colors.text,
    },
    searchClear: { position: "absolute", right: spacing.md, zIndex: 1 },
    filters: {
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    listModeRow: {
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
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
    mealRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mealMainTap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minWidth: 0,
    },
    mealIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    mealInfo: { flex: 1, minWidth: 0 },
    mealName: { fontSize: 16, color: colors.text, fontWeight: "600" },
    mealMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    mealEditBtn: { padding: 8 },
    mealLogBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
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
      marginBottom: spacing.sm,
    },
    loggedTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    loggedMeta: { fontSize: 13, color: colors.textMuted },
    loggedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    loggedMain: { flex: 1, minWidth: 0 },
    loggedInfo: { minWidth: 0 },
    loggedName: { fontSize: 15, color: colors.text, fontWeight: "600" },
    loggedSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    loggedIconBtn: { padding: 8 },
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
