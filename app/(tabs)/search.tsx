import { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, FlatList, Pressable } from "react-native"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { Fab } from "@/components/Fab"
import { FabCluster } from "@/components/FabCluster"
import { EmptyState } from "@/components/EmptyState"
import { FoodListItem } from "@/components/FoodListItem"
import { OfflineBanner } from "@/components/OfflineBanner"
import { PageContainer } from "@/components/PageContainer"
import { useDebounce } from "@/hooks/useDebounce"
import { useFoodSearch } from "@/hooks/useFoodSearch"
import { useApp } from "@/context/AppContext"
import { useToast } from "@/context/ToastContext"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { toggleFavorite, getFavoriteFoods, getRecentFoodUsages } from "@/db/food-cache"
import { quickLogFood } from "@/services/diary"
import type { MealType, RecentFoodUsage, SearchFoodResult } from "@/types"
import { toDateKey } from "@/utils/date"
import { routeParam } from "@/utils/route"
import { displayUnit, formatUsageAmountLine } from "@/utils/food-display"
import { MEAL_LABELS } from "@/utils/meals"
import { layout, spacing } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Input, InputField, InputIcon } from "@ui/input"
import { SegmentedControl } from "@/components/SegmentedControl"

type ListMode = "recents" | "favorites"
type FoodRow = SearchFoodResult | RecentFoodUsage

function isUsageRow(row: FoodRow): row is RecentFoodUsage {
  return "lastLoggedAt" in row
}

export default function SearchScreen() {
  const router = useRouter()
  const routeParams = useLocalSearchParams<{ meal?: string; date?: string }>()
  const addMeal = (routeParam(routeParams.meal) ?? "lunch") as MealType
  const addDate = routeParam(routeParams.date) ?? toDateKey()
  const { yazioAvailable } = useApp()
  const { showError, showSuccess } = useToast()
  const { colors } = useTheme()
  const { isWide, isMedium } = useLayout()
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState("")
  const debounced = useDebounce(query, 200)
  const [listMode, setListMode] = useState<ListMode>("recents")
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [addingKey, setAddingKey] = useState<string | null>(null)
  const [searchFailed, setSearchFailed] = useState(false)

  // A local (SQLite) failure must not masquerade as "no foods found" —
  // show an explicit error state instead.
  const handleSearchError = useCallback(() => setSearchFailed(true), [])

  const loadFavorites = useCallback(async () => {
    const favs = await getFavoriteFoods()
    setFavoriteIds(new Set(favs.map((f) => f.product_id)))
  }, [])

  // Star toggles inside add-food must show up when coming back to this tab.
  useFocusEffect(
    useCallback(() => {
      loadFavorites()
    }, [loadFavorites]),
  )

  const emptyQuery = useCallback(async () => {
    if (listMode === "favorites") return getFavoriteFoods()
    return getRecentFoodUsages(10)
  }, [listMode])

  const { foods, loading, refresh } = useFoodSearch<FoodRow>(debounced, {
    emptyQuery,
    onError: handleSearchError,
  })

  // Keep the current recents/favorites list rendered below search results
  // instead of replacing it the moment the user types.
  // Reset synchronously when the query clears (render-adjustment pattern).
  const [prevDebounced, setPrevDebounced] = useState(debounced)
  const [contextual, setContextual] = useState<FoodRow[]>([])
  if (prevDebounced !== debounced) {
    setPrevDebounced(debounced)
    if (!debounced.trim()) setContextual([])
    // A new query (or a cleared one) clears any stale search error so a
    // retry of the same search re-runs cleanly.
    setSearchFailed(false)
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

  const openFood = useCallback(
    (food: SearchFoodResult) => {
      router.push({
        pathname: "/add-food",
        params: {
          meal: addMeal,
          date: addDate,
          productId: food.product_id,
        },
      })
    },
    [addDate, addMeal, router],
  )

  const handleQuickAdd = useCallback(
    async (food: SearchFoodResult, amount?: number) => {
      const key = amount != null ? `${food.product_id}:${amount}` : food.product_id
      if (addingKey === key) return
      setAddingKey(key)
      try {
        const { amount: logged } = await quickLogFood({
          date: addDate,
          mealType: addMeal,
          food,
          amount,
        })
        showSuccess(
          `Added ${food.name} · ${logged} ${displayUnit(food.base_unit || "g")} to ${MEAL_LABELS[addMeal]}.`,
          "Added",
        )
        refresh()
      } catch (error) {
        showError(error, "Could not add food.")
      } finally {
        setAddingKey(null)
      }
    },
    [addDate, addMeal, addingKey, refresh, showError, showSuccess],
  )

  const handleToggleFavorite = useCallback(async (food: SearchFoodResult) => {
    const isFav = await toggleFavorite(food.product_id, food)
    setFavoriteIds((prev) => {
      const next = new Set(prev)
      if (isFav) next.add(food.product_id)
      else next.delete(food.product_id)
      return next
    })
  }, [])

  const renderItem = useCallback(
    ({ item }: { item: FoodRow }) => {
      if (isUsageRow(item)) {
        return (
          <FoodListItem
            food={item.food}
            subtitle={formatUsageAmountLine(item.food, item.amount)}
            onPress={() => openFood(item.food)}
            onQuickAdd={() => handleQuickAdd(item.food, item.amount)}
            quickAdding={addingKey === `${item.food.product_id}:${item.amount}`}
            isFavorite={favoriteIds.has(item.food.product_id)}
            onToggleFavorite={() => handleToggleFavorite(item.food)}
          />
        )
      }
      return (
        <FoodListItem
          food={item}
          onPress={() => openFood(item)}
          onQuickAdd={() => handleQuickAdd(item)}
          quickAdding={addingKey === item.product_id}
          isFavorite={favoriteIds.has(item.product_id)}
          onToggleFavorite={() => handleToggleFavorite(item)}
        />
      )
    },
    [addingKey, favoriteIds, handleQuickAdd, handleToggleFavorite, openFood],
  )

  const switchListMode = useCallback((mode: ListMode) => {
    // A typed query means search results, not recents/favorites — clear it
    // so the selected list actually shows. The tabs stay visible either way.
    setQuery("")
    setListMode(mode)
    setSearchFailed(false)
  }, [])

  const openScan = useCallback(() => {
    router.push({ pathname: "/scan", params: { meal: addMeal, date: addDate } })
  }, [addDate, addMeal, router])

  const emptyContent = useMemo(() => {
    if (loading) return null
    if (searchFailed) {
      return (
        <EmptyState
          icon="cloud-offline-outline"
          iconColor={colors.danger}
          title="Could not search foods"
          message="Something went wrong locally. Pull to refresh or try again."
          className="mt-12"
        />
      )
    }
    if (debounced) {
      return (
        <EmptyState
          icon="search-outline"
          iconColor={colors.textMuted}
          title="No foods found"
          message="Try a different spelling."
          className="mt-12"
        />
      )
    }
    if (listMode === "favorites") {
      return (
        <EmptyState
          icon="star-outline"
          iconColor={colors.warning}
          title="No favorites yet"
          message="Star foods to find them here fast."
        />
      )
    }
    return (
      <EmptyState
        icon="search-outline"
        iconColor={colors.primary}
        title="Find your foods"
        message="Search the YAZIO database. Recents and favorites show up here."
      />
    )
  }, [
    colors.textMuted,
    colors.primary,
    colors.warning,
    colors.danger,
    debounced,
    listMode,
    loading,
    searchFailed,
  ])

  return (
    <Box className="flex-1 bg-background-0">
      <PageContainer variant={isWide ? "wide" : "default"} className="flex-1">
        <OfflineBanner visible={!yazioAvailable && debounced.length > 0} />
        <Box
          className={`${isWide ? "px-8" : "px-6"} pb-3`}
          style={{ paddingTop: insets.top + spacing.md }}
        >
          <Input size="lg" variant="rounded" className="bg-background-50">
            <InputIcon>
              <Ionicons name="search" size={20} color={colors.textMuted} />
            </InputIcon>
            <InputField
              placeholder="e.g. banana, oats, chicken"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search foods"
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => setQuery("")}
                className="pr-3"
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </Input>
          <Box className="mt-3">
            <SegmentedControl<ListMode>
              value={listMode}
              options={[
                { value: "recents", label: "Recents" },
                { value: "favorites", label: "Favorites" },
              ]}
              onChange={switchListMode}
            />
          </Box>
        </Box>
        {loading ? (
          <Box className="items-center py-3">
            <ActivityIndicator color={colors.primary} />
          </Box>
        ) : null}
        <FlatList
          className="flex-1"
          data={foods}
          contentContainerClassName={foods.length === 0 ? "grow justify-center pb-8" : "pt-1 pb-36"}
          keyExtractor={(item) =>
            isUsageRow(item) ? `${item.food.product_id}-${item.amount}` : item.product_id
          }
          renderItem={renderItem}
          ListEmptyComponent={emptyContent}
          ListFooterComponent={
            debounced && contextual.length > 0 ? (
              <Box className="mt-4 border-t border-outline-200 pt-3">
                <Text size="sm" bold className="px-4 pb-1 text-typography-500">
                  {listMode === "favorites" ? "Favorite picks" : "Recently used"}
                </Text>
                {contextual.map((item) => (
                  <FoodListItem
                    key={
                      isUsageRow(item) ? `${item.food.product_id}-${item.amount}` : item.product_id
                    }
                    food={isUsageRow(item) ? item.food : item}
                    subtitle={
                      isUsageRow(item) ? formatUsageAmountLine(item.food, item.amount) : undefined
                    }
                    onPress={() => openFood(isUsageRow(item) ? item.food : item)}
                    onQuickAdd={() =>
                      isUsageRow(item)
                        ? handleQuickAdd(item.food, item.amount)
                        : handleQuickAdd(item)
                    }
                    quickAdding={
                      isUsageRow(item)
                        ? addingKey === `${item.food.product_id}:${item.amount}`
                        : addingKey === item.product_id
                    }
                    isFavorite={favoriteIds.has(
                      isUsageRow(item) ? item.food.product_id : item.product_id,
                    )}
                    onToggleFavorite={() =>
                      handleToggleFavorite(isUsageRow(item) ? item.food : item)
                    }
                  />
                ))}
              </Box>
            ) : undefined
          }
        />
      </PageContainer>

      <FabCluster
        right={
          <Fab
            icon="barcode-outline"
            label={isMedium ? "Scan" : undefined}
            onPress={openScan}
            accessibilityLabel="Scan barcode"
          />
        }
        bottomOffset={layout.tabBarHeight + insets.bottom + 24}
      />
    </Box>
  )
}
