import { useEffect, useState } from 'react';
import {
  View,
  TextInput,
  FlatList,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FoodListItem } from '@/components/FoodListItem';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useDebounce } from '@/hooks/useDebounce';
import { useApp } from '@/context/AppContext';
import { searchFoods } from '@/services/yazio/foods';
import { toggleFavorite, getFavoriteFoods } from '@/db/food-cache';
import type { SearchFoodResult } from '@/types';
import { toDateKey } from '@/utils/date';
import { colors, spacing } from '@/theme';

export default function SearchScreen() {
  const router = useRouter();
  const { yazioAvailable, setYazioAvailable } = useApp();
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
      } catch {
        if (!cancelled) {
          setYazioAvailable(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
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
        meal: 'lunch',
        date: toDateKey(),
        productId: food.product_id,
        name: food.name,
        kcal: String(food.nutrients.kcal),
        amount: String(food.serving.amount),
        unit: food.base_unit,
        protein: String(food.nutrients.protein),
        carbs: String(food.nutrients.carbs),
        fat: String(food.nutrients.fat),
        serving: food.serving.serving,
        servingQty: String(food.serving.serving_quantity),
      },
    });
  };

  const data = [...local, ...remote.filter((r) => !local.some((l) => l.product_id === r.product_id))];

  return (
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
