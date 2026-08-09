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
import { MealLogFoodRow } from "@/components/MealLogFoodRow"
import { SegmentedControl } from "@/components/SegmentedControl"
import { OfflineBanner } from "@/components/OfflineBanner"
import { Fab } from "@/components/Fab"
import { useDebounce } from "@/hooks/useDebounce"
import { useFoodSearch } from "@/hooks/useFoodSearch"
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible"
import { useApp } from "@/context/AppContext"
import { useToast } from "@/context/ToastContext"
import { getSuggestedFoods } from "@/services/yazio/foods"
import { getFavoriteFoods, getRecentFoods } from "@/db/food-cache"
import { listMeals, logMealToDiary, mealTotals } from "@/services/meals"
import type { FoodNutrients, Meal, MealType, SearchFoodResult } from "@/types"
import { mergeFoodResults } from "@/utils/food-search"
import { MEAL_LABELS } from "@/utils/meals"
import { formatServingOption } from "@/utils/food-display"
import { toDateKey } from "@/utils/date"
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
  const keyboardOpen = useKeyboardVisible()

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
    const [favorites, recent] = await Promise.all([getFavoriteFoods(), getRecentFoods(20)])
    if (listMode === "favorites") return favorites
    if (listMode === "recent") return recent
    // Frequent list: local picks first, YAZIO's suggestions patch in when ready.
    return mergeFoodResults(mergeFoodResults(suggestions, favorites), recent)
  }, [listMode, suggestions])

  const handleSearchError = useCallback(
    (error: unknown) => showError(error, "Could not load foods."),
    [showError],
  )

  const { foods, loading, refresh } = useFoodSearch(debounced, {
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

  // Refetch favorites/recent/meals when returning from add-food or meal-builder.
  useFocusEffect(
    useCallback(() => {
      if (category === "meals") {
        loadMeals()
      } else if (!debounced.trim() && listMode !== "frequent") {
        refresh()
      }
    }, [category, debounced, listMode, loadMeals, refresh]),
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

  const subtitles = useMemo(
    () => new Map(foods.map((food) => [food.product_id, foodSubtitle(food)])),
    [foods],
  )

  const renderFood = useCallback(
    ({ item }: { item: SearchFoodResult }) => (
      <MealLogFoodRow
        food={item}
        subtitle={subtitles.get(item.product_id)}
        accentColor={accent}
        onPress={() => openFood(item)}
        onAdd={() => openFood(item)}
      />
    ),
    [accent, openFood, subtitles],
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
      return "No meals yet. Create one and it will show up here."
    }
    if (debounced.trim()) return "No foods found. Try a different search."
    if (listMode === "favorites") return "No favorites yet. Star foods from search results."
    if (listMode === "recent") return "No recent foods yet. Log something to see it here."
    return "Search or scan a barcode to build your food list."
  }, [category, debounced, listMode])

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ModalContainer surface>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
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
          />
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
            keyExtractor={(item) => item.product_id}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName={
              foods.length === 0 && !loading ? "grow justify-center" : "pt-1 pb-24"
            }
            renderItem={renderFood}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyWrap}>
                  <View style={[styles.emptyIcon, { backgroundColor: `${accent}1a` }]}>
                    <Ionicons name="fast-food-outline" size={26} color={accent} />
                  </View>
                  <Text style={styles.empty}>{emptyMessage}</Text>
                </View>
              ) : null
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
            ListEmptyComponent={!loading ? <Text style={styles.empty}>{emptyMessage}</Text> : null}
          />
        )}
      </ModalContainer>

      {!keyboardOpen ? (
        <View style={styles.fabLayer} pointerEvents="box-none">
          <View style={[styles.fabLeft, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
            <Fab tone="surface" icon="close" onPress={safeBack} accessibilityLabel="Cancel" />
          </View>
          <View style={[styles.fabRight, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
            <Fab icon="checkmark" onPress={safeBack} accessibilityLabel="Done" />
          </View>
        </View>
      ) : null}
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
      paddingRight: spacing.md,
      fontSize: 16,
      color: colors.text,
    },
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
    emptyWrap: {
      alignItems: "center",
      paddingTop: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    empty: {
      textAlign: "center",
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
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
    mealEditBtn: { padding: 4 },
    mealLogBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    fabLayer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    fabLeft: {
      position: "absolute",
      left: 20,
      alignItems: "flex-start",
    },
    fabRight: {
      position: "absolute",
      right: 20,
      alignItems: "flex-end",
    },
  })
