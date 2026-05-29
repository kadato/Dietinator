import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MealLogFoodRow } from '@/components/MealLogFoodRow';
import { FilterDropdown } from '@/components/FilterDropdown';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useDebounce } from '@/hooks/useDebounce';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { searchFoods } from '@/services/yazio/foods';
import { getFavoriteFoods, getRecentFoods } from '@/db/food-cache';
import type { MealType, SearchFoodResult } from '@/types';
import { MEAL_LABELS, MEAL_PLACEHOLDERS } from '@/utils/meals';
import { formatServingOption } from '@/utils/food-display';
import { toDateKey } from '@/utils/date';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { spacing, type ColorPalette } from '@/theme';

function routeParam(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

type LogMode = 'search' | 'camera' | 'barcode' | 'more';
type FoodCategory = 'foods' | 'meals' | 'recipes';
type ListMode = 'frequent' | 'recent' | 'favorites';

const MODE_OPTIONS: { id: LogMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'camera', label: 'Camera', icon: 'camera' },
  { id: 'barcode', label: 'Barcode', icon: 'barcode-outline' },
  { id: 'more', label: 'More', icon: 'ellipsis-horizontal' },
];

export default function LogMealScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: string; date?: string }>();
  const mealType = (routeParam(params.meal) ?? 'lunch') as MealType;
  const date = routeParam(params.date) ?? toDateKey();
  const { yazioAvailable, setYazioAvailable } = useApp();
  const { showError, showWarning } = useToast();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const mealAccent: Record<MealType, string> = {
    breakfast: colors.breakfast,
    lunch: colors.lunch,
    dinner: colors.dinner,
    snack: colors.snack,
  };
  const accent = mealAccent[mealType];

  const [mode, setMode] = useState<LogMode>('search');
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 200);
  const [category, setCategory] = useState<FoodCategory>('foods');
  const [listMode, setListMode] = useState<ListMode>('frequent');
  const [foods, setFoods] = useState<SearchFoodResult[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFoods = useCallback(async () => {
    if (category !== 'foods') {
      setFoods([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (debounced.trim()) {
        const result = await searchFoods(debounced);
        const merged = [
          ...result.local,
          ...result.remote.filter(
            (r) => !result.local.some((l) => l.product_id === r.product_id),
          ),
        ];
        setFoods(merged);
        setYazioAvailable(result.remote.length > 0 || !debounced.trim());
      } else if (listMode === 'favorites') {
        setFoods(await getFavoriteFoods());
      } else if (listMode === 'recent') {
        setFoods(await getRecentFoods(20));
      } else {
        const result = await searchFoods('');
        setFoods(result.local);
      }
    } catch (error) {
      setYazioAvailable(false);
      showError(error, 'Could not load foods.');
    } finally {
      setLoading(false);
    }
  }, [category, debounced, listMode, setYazioAvailable, showError]);

  useEffect(() => {
    loadFoods();
  }, [loadFoods]);

  const openFood = (food: SearchFoodResult) => {
    router.push({
      pathname: '/add-food',
      params: { meal: mealType, date, productId: food.product_id },
    });
  };

  const handleMode = (next: LogMode) => {
    if (next === 'barcode') {
      router.push({ pathname: '/scan', params: { meal: mealType, date } });
      return;
    }
    if (next === 'camera') {
      showWarning(
        'Photo-based food recognition is not available in Dietinator yet. Use search or barcode instead.',
        'Camera',
      );
      return;
    }
    if (next === 'more') {
      router.push({ pathname: '/create-options', params: { meal: mealType, date } });
      return;
    }
    setMode(next);
  };

  const foodSubtitle = (food: SearchFoodResult) => {
    const unit = food.base_unit || 'g';
    const producer = food.producer?.trim();
    const serving = formatServingOption(food.serving, unit);
    return producer ? `${producer}, ${serving}` : serving;
  };

  const emptyMessage = useMemo(() => {
    if (category !== 'foods') {
      return 'Meals and recipes are not supported yet.';
    }
    if (debounced.trim()) return 'No foods found. Try a different search.';
    if (listMode === 'favorites') return 'No favorites yet. Star foods from search results.';
    if (listMode === 'recent') return 'No recent foods yet. Log something to see it here.';
    return 'Search or scan a barcode to build your food list.';
  }, [category, debounced, listMode]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{MEAL_LABELS[mealType]}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.modeRow}>
        {MODE_OPTIONS.map((item) => {
          const active = mode === item.id && item.id === 'search';
          return (
            <Pressable
              key={item.id}
              style={[styles.modeBtn, active && { borderColor: accent }]}
              onPress={() => handleMode(item.id)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Ionicons
                name={item.icon}
                size={22}
                color={item.id === 'search' ? accent : colors.textMuted}
              />
              <Text style={[styles.modeLabel, active && { color: accent }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { borderColor: accent }]}
          placeholder={MEAL_PLACEHOLDERS[mealType]}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      <View style={styles.filters}>
        <FilterDropdown<FoodCategory>
          value={category}
          options={[
            { value: 'foods', label: 'Foods' },
            { value: 'meals', label: 'Meals' },
            { value: 'recipes', label: 'Recipes' },
          ]}
          onChange={setCategory}
        />
        <FilterDropdown<ListMode>
          value={listMode}
          options={[
            { value: 'frequent', label: 'Frequent' },
            { value: 'recent', label: 'Recent' },
            { value: 'favorites', label: 'Favorites' },
          ]}
          onChange={setListMode}
        />
      </View>

      <OfflineBanner visible={!yazioAvailable && debounced.length > 0} />

      {loading ? (
        <ActivityIndicator style={styles.loader} color={accent} />
      ) : null}

      <FlatList
        style={styles.list}
        data={foods}
        keyExtractor={(item) => item.product_id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <MealLogFoodRow
            food={item}
            subtitle={foodSubtitle(item)}
            accentColor={accent}
            onPress={() => openFood(item)}
            onAdd={() => openFood(item)}
          />
        )}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>{emptyMessage}</Text> : null
        }
      />

      <View style={styles.footer}>
        <View style={[styles.footerCount, { backgroundColor: accent }]}>
          <Text style={styles.footerCountText}>0</Text>
        </View>
        <Pressable
          style={styles.doneBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    headerSpacer: { width: 28 },
    title: {
      flex: 1,
      textAlign: 'center',
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    modeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    modeBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 4,
    },
    modeLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    searchIcon: { position: 'absolute', left: spacing.md + 10, zIndex: 1 },
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
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    loader: { marginVertical: spacing.sm },
    list: { flex: 1 },
    empty: {
      textAlign: 'center',
      color: colors.textMuted,
      marginTop: spacing.xl,
      paddingHorizontal: spacing.lg,
      fontSize: 14,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      paddingBottom: spacing.lg,
      backgroundColor: colors.primary,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    },
    footerCount: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerCountText: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 16,
    },
    doneBtn: {
      flex: 1,
      backgroundColor: colors.primaryMuted,
      borderRadius: 28,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    doneText: {
      color: colors.onPrimary,
      fontSize: 17,
      fontWeight: '700',
    },
  });
