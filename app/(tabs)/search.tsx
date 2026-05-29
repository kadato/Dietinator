import { useEffect, useState } from 'react';
import {
  View,
  TextInput,
  FlatList,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FoodListItem } from '@/components/FoodListItem';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PageContainer } from '@/components/PageContainer';
import { useDebounce } from '@/hooks/useDebounce';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { searchFoods } from '@/services/yazio/foods';
import { toggleFavorite, getFavoriteFoods } from '@/db/food-cache';
import type { MealType, SearchFoodResult } from '@/types';
import { toDateKey } from '@/utils/date';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { spacing, type ColorPalette } from '@/theme';

function routeParam(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default function SearchScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ meal?: string; date?: string }>();
  const addMeal = (routeParam(routeParams.meal) ?? 'lunch') as MealType;
  const addDate = routeParam(routeParams.date) ?? toDateKey();
  const { yazioAvailable, setYazioAvailable } = useApp();
  const { showError } = useToast();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 200);
  const [local, setLocal] = useState<SearchFoodResult[]>([]);
  const [remote, setRemote] = useState<SearchFoodResult[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const favs = await getFavoriteFoods();
      setFavoriteIds(new Set(favs.map((f) => f.product_id)));
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await searchFoods(debounced);
        if (!cancelled) {
          setLocal(result.local);
          setRemote(result.remote);
          setYazioAvailable(result.remote.length > 0 || !debounced.trim());
        }
      } catch (error) {
        if (!cancelled) {
          setYazioAvailable(false);
          showError(error, 'Food search failed. Showing cached results only.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, setYazioAvailable, showError]);

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
    <View style={styles.container}>
      <PageContainer>
        <OfflineBanner visible={!yazioAvailable && debounced.length > 0} />
        <TextInput
          style={styles.input}
          placeholder="Search YAZIO foods..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {loading && <ActivityIndicator style={styles.loader} color={colors.primary} />}
        {!debounced && (
          <Text style={styles.hint}>Recent and favorite foods appear when the search is empty.</Text>
        )}
        <FlatList
          style={styles.list}
          data={data}
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
              <Text style={styles.empty}>No foods found. Try a different search.</Text>
            ) : null
          }
        />
      </PageContainer>
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1 },
  input: {
    margin: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loader: { marginBottom: spacing.sm },
  hint: {
    paddingHorizontal: spacing.md,
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.xl,
    padding: spacing.md,
  },
});
