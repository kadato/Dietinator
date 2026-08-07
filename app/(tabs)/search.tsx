import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FoodListItem } from '@/components/FoodListItem';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PageContainer } from '@/components/PageContainer';
import { useDebounce } from '@/hooks/useDebounce';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/useTheme';
import { searchFoodsRemote } from '@/services/yazio/foods';
import { searchLocalFoods, toggleFavorite, getFavoriteFoods } from '@/db/food-cache';
import type { MealType, SearchFoodResult } from '@/types';
import { toDateKey } from '@/utils/date';
import { routeParam } from '@/utils/route';
import { Box } from '@ui/box';
import { Text } from '@ui/text';
import { Input, InputField, InputIcon } from '@ui/input';

export default function SearchScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ meal?: string; date?: string }>();
  const addMeal = (routeParam(routeParams.meal) ?? 'lunch') as MealType;
  const addDate = routeParam(routeParams.date) ?? toDateKey();
  const { yazioAvailable, setYazioAvailable } = useApp();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 200);
  const [local, setLocal] = useState<SearchFoodResult[]>([]);
  const [remote, setRemote] = useState<SearchFoodResult[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  const loadFavorites = useCallback(async () => {
    const favs = await getFavoriteFoods();
    setFavoriteIds(new Set(favs.map((f) => f.product_id)));
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // Star toggles inside add-food must show up when coming back to this tab.
  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites]),
  );

  useEffect(() => {
    let cancelled = false;
    const requestId = ++requestRef.current;
    (async () => {
      const trimmed = debounced.trim();
      if (!trimmed) {
        const favs = await getFavoriteFoods();
        const recents = await searchLocalFoods('');
        const seen = new Set<string>();
        const merged: SearchFoodResult[] = [];
        for (const item of [...favs, ...recents]) {
          if (!seen.has(item.product_id)) {
            seen.add(item.product_id);
            merged.push(item);
          }
        }
        if (!cancelled) {
          setLocal(merged);
          setRemote([]);
          setLoading(false);
        }
        return;
      }

      // Cached results render instantly; remote patches in when it arrives.
      setLoading(true);
      const cached = await searchLocalFoods(trimmed);
      if (requestId !== requestRef.current || cancelled) return;
      setLocal(cached);
      setLoading(false);

      try {
        const found = await searchFoodsRemote(trimmed);
        if (requestId !== requestRef.current || cancelled) return;
        setRemote(found);
        setYazioAvailable(true);
      } catch {
        if (requestId !== requestRef.current || cancelled) return;
        setYazioAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, setYazioAvailable]);

  const openFood = (food: SearchFoodResult) => {
    router.push({
      pathname: '/add-food',
      params: {
        meal: addMeal,
        date: addDate,
        productId: food.product_id,
      },
    });
  };

  const data = [...local, ...remote.filter((r) => !local.some((l) => l.product_id === r.product_id))];

  return (
    <Box className="flex-1 bg-background-0">
      <PageContainer className="flex-1">
        <OfflineBanner visible={!yazioAvailable && debounced.length > 0} />
        <Box className="px-4 pt-2 pb-3">
          <Text size="2xl" bold className="text-typography-900 mb-3">
            Search foods
          </Text>
          <Input size="lg" variant="rounded" className="bg-background-50">
            <InputIcon>
              <Ionicons name="search" size={20} color={colors.textMuted} />
            </InputIcon>
            <InputField
              placeholder="Search YAZIO foods..."
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
            />
          </Input>
        </Box>
        {loading ? (
          <ActivityIndicator className="mb-2" color={colors.primary} />
        ) : null}
        {!debounced ? (
          <Text size="sm" className="text-typography-500 px-5 mb-2">
            Recent and favorite foods appear when the search is empty.
          </Text>
        ) : null}
        <FlatList
          className="flex-1"
          data={data}
          contentContainerClassName="pt-1 pb-8"
          keyExtractor={(item) => item.product_id}
          renderItem={({ item }) => (
            <FoodListItem
              food={item}
              onPress={() => openFood(item)}
              isFavorite={favoriteIds.has(item.product_id)}
              onToggleFavorite={async () => {
                const isFav = await toggleFavorite(item.product_id);
                setFavoriteIds((prev) => {
                  const next = new Set(prev);
                  if (isFav) next.add(item.product_id);
                  else next.delete(item.product_id);
                  return next;
                });
              }}
            />
          )}
          ListEmptyComponent={
            !loading && debounced ? (
              <Box className="items-center mt-12 px-6">
                <Ionicons name="search-outline" size={48} color={colors.textMuted} />
                <Text size="md" bold className="text-typography-900 mt-4 text-center">
                  No foods found
                </Text>
                <Text size="sm" className="text-typography-500 mt-1 text-center">
                  Try a different spelling or a shorter name.
                </Text>
              </Box>
            ) : null
          }
        />
      </PageContainer>
    </Box>
  );
}
