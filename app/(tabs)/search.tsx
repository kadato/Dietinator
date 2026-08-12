import { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, View } from "react-native"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { Fab } from "@/components/Fab"
import { FoodListItem } from "@/components/FoodListItem"
import { OfflineBanner } from "@/components/OfflineBanner"
import { PageContainer } from "@/components/PageContainer"
import { useDebounce } from "@/hooks/useDebounce"
import { useFoodSearch } from "@/hooks/useFoodSearch"
import { useApp } from "@/context/AppContext"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"
import { toggleFavorite, getFavoriteFoods, getRecentFoods } from "@/db/food-cache"
import type { MealType, SearchFoodResult } from "@/types"
import { toDateKey } from "@/utils/date"
import { routeParam } from "@/utils/route"
import { layout, spacing } from "@/theme"
import { Box } from "@ui/box"
import { Text } from "@ui/text"
import { Input, InputField, InputIcon } from "@ui/input"
import { SegmentedControl } from "@/components/SegmentedControl"

type ListMode = "recents" | "favorites"

export default function SearchScreen() {
  const router = useRouter()
  const routeParams = useLocalSearchParams<{ meal?: string; date?: string }>()
  const addMeal = (routeParam(routeParams.meal) ?? "lunch") as MealType
  const addDate = routeParam(routeParams.date) ?? toDateKey()
  const { yazioAvailable } = useApp()
  const { colors } = useTheme()
  const { isWide } = useLayout()
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState("")
  const debounced = useDebounce(query, 200)
  const [listMode, setListMode] = useState<ListMode>("recents")
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())

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
    return getRecentFoods()
  }, [listMode])

  const { foods, loading } = useFoodSearch(debounced, { emptyQuery })

  // Keep the current recents/favorites list rendered below search results
  // instead of replacing it the moment the user types.
  const [contextual, setContextual] = useState<SearchFoodResult[]>([])
  // Reset synchronously when the query clears (render-adjustment pattern).
  const [prevDebounced, setPrevDebounced] = useState(debounced)
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

  const handleToggleFavorite = useCallback(async (food: SearchFoodResult) => {
    const isFav = await toggleFavorite(food.product_id, food)
    setFavoriteIds((prev) => {
      const next = new Set(prev)
      if (isFav) next.add(food.product_id)
      else next.delete(food.product_id)
      return next
    })
  }, [])

  const switchListMode = useCallback((mode: ListMode) => {
    // A typed query means search results, not recents/favorites — clear it
    // so the selected list actually shows. The tabs stay visible either way.
    setQuery("")
    setListMode(mode)
  }, [])

  const openScan = useCallback(() => {
    router.push({ pathname: "/scan", params: { meal: addMeal, date: addDate } })
  }, [addDate, addMeal, router])

  const renderItem = useCallback(
    ({ item }: { item: SearchFoodResult }) => (
      <FoodListItem
        food={item}
        onPress={() => openFood(item)}
        isFavorite={favoriteIds.has(item.product_id)}
        onToggleFavorite={() => handleToggleFavorite(item)}
      />
    ),
    [favoriteIds, handleToggleFavorite, openFood],
  )

  const emptyContent = useMemo(() => {
    if (loading) return null
    if (debounced) {
      return (
        <Box className="mt-12 items-center px-6">
          <Ionicons name="search-outline" size={48} color={colors.textMuted} />
          <Text size="md" bold className="mt-4 text-center text-typography-900">
            No foods found
          </Text>
          <Text size="sm" className="mt-1 text-center text-typography-500">
            Try a different spelling or a shorter name.
          </Text>
        </Box>
      )
    }
    if (listMode === "favorites") {
      return (
        <Box className="items-center px-6 pb-10">
          <Box className="h-20 w-20 items-center justify-center rounded-2xl bg-background-50 shadow-soft-1">
            <Ionicons name="star-outline" size={36} color={colors.warning} />
          </Box>
          <Text size="lg" bold className="mt-5 text-center text-typography-900">
            No favorites yet
          </Text>
          <Text
            size="sm"
            className="mt-2 text-center leading-5 text-typography-500"
            style={{ maxWidth: 420 }}
          >
            Tap the star on any food to keep it here for quick logging.
          </Text>
        </Box>
      )
    }
    return (
      <Box className="items-center px-6 pb-10">
        <Box className="h-20 w-20 items-center justify-center rounded-2xl bg-background-50 shadow-soft-1">
          <Ionicons name="search-outline" size={36} color={colors.primary} />
        </Box>
        <Text size="lg" bold className="mt-5 text-center text-typography-900">
          Find your foods
        </Text>
        <Text
          size="sm"
          className="mt-2 text-center leading-5 text-typography-500"
          style={{ maxWidth: 420 }}
        >
          Type to search foods from the YAZIO database. Recent and favorite picks show up here.
        </Text>
      </Box>
    )
  }, [colors.textMuted, colors.primary, colors.warning, debounced, listMode, loading])

  return (
    <Box className="flex-1 bg-background-0">
      <PageContainer variant={isWide ? "wide" : "default"} className="flex-1">
        <OfflineBanner visible={!yazioAvailable && debounced.length > 0} />
        <Box
          className={`${isWide ? "px-8" : "px-4"} pb-3`}
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
        {loading ? <ActivityIndicator className="mb-2" color={colors.primary} /> : null}
        <FlatList
          className="flex-1"
          data={foods}
          contentContainerClassName={foods.length === 0 ? "grow justify-center pb-8" : "pt-1 pb-32"}
          keyExtractor={(item) => item.product_id}
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
                    key={item.product_id}
                    food={item}
                    onPress={() => openFood(item)}
                    isFavorite={favoriteIds.has(item.product_id)}
                    onToggleFavorite={() => handleToggleFavorite(item)}
                  />
                ))}
              </Box>
            ) : undefined
          }
        />
      </PageContainer>

      <View
        style={{
          position: "absolute",
          right: 20,
          bottom: layout.tabBarHeight + insets.bottom + 24,
          pointerEvents: "box-none",
        }}
      >
        <Fab
          icon="barcode-outline"
          label="Scan"
          onPress={openScan}
          accessibilityLabel="Scan barcode"
        />
      </View>
    </Box>
  )
}
