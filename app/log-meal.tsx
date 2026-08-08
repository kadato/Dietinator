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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MealLogFoodRow } from '@/components/MealLogFoodRow';
import { SegmentedControl } from '@/components/SegmentedControl';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useDebounce } from '@/hooks/useDebounce';
import { useFoodSearch } from '@/hooks/useFoodSearch';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/context/ToastContext';
import { getSuggestedFoods } from '@/services/yazio/foods';
import { getFavoriteFoods, getRecentFoods } from '@/db/food-cache';
import { listMeals, logMealToDiary, mealTotals } from '@/services/meals';
import type { FoodNutrients, Meal, MealType, SearchFoodResult } from '@/types';
import { mergeFoodResults } from '@/utils/food-search';
import { MEAL_LABELS, MEAL_PLACEHOLDERS } from '@/utils/meals';
import { formatServingOption } from '@/utils/food-display';
import { formatDisplayDate, toDateKey } from '@/utils/date';
import { routeParam } from '@/utils/route';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { ModalContainer } from '@/components/ModalContainer';
import { spacing, type ColorPalette } from '@/theme';

type LogMode = 'search' | 'camera' | 'barcode' | 'more';
type FoodCategory = 'foods' | 'meals';
type ListMode = 'frequent' | 'recent' | 'favorites';

const MODE_OPTIONS: { id: LogMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'camera', label: 'Camera', icon: 'camera' },
  { id: 'barcode', label: 'Barcode', icon: 'barcode-outline' },
  { id: 'more', label: 'More', icon: 'ellipsis-horizontal' },
];

const CATEGORY_OPTIONS: { value: FoodCategory; label: string }[] = [
  { value: 'foods', label: 'Foods' },
  { value: 'meals', label: 'Meals' },
];

const ZERO_TOTALS: FoodNutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

const LIST_MODE_OPTIONS: { value: ListMode; label: string }[] = [
  { value: 'frequent', label: 'Frequent' },
  { value: 'recent', label: 'Recent' },
  { value: 'favorites', label: 'Favorites' },
];

function foodSubtitle(food: SearchFoodResult): string {
  const unit = food.base_unit || 'g';
  const producer = food.producer?.trim();
  const serving = formatServingOption(food.serving, unit);
  return producer ? `${producer}, ${serving}` : serving;
}

export default function LogMealScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: string; date?: string }>();
  const mealType = (routeParam(params.meal) ?? 'lunch') as MealType;
  const date = routeParam(params.date) ?? toDateKey();
  const { yazioAvailable } = useApp();
  const { showError, showWarning, showSuccess } = useToast();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const accent = colors[mealType];

  const [mode, setMode] = useState<LogMode>('search');
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 200);
  const [category, setCategory] = useState<FoodCategory>('foods');
  const [listMode, setListMode] = useState<ListMode>('frequent');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loggingMealId, setLoggingMealId] = useState<string | null>(null);

  const emptyQuery = useCallback(async () => {
    if (listMode === 'favorites') return getFavoriteFoods();
    if (listMode === 'recent') return getRecentFoods(20);
    // Frequent list: YAZIO's suggestions for this meal slot, then favorites + recents.
    const [suggested, favorites, recent] = await Promise.all([
      getSuggestedFoods(date, mealType, 5),
      getFavoriteFoods(),
      getRecentFoods(20),
    ]);
    return mergeFoodResults(mergeFoodResults(suggested, favorites), recent);
  }, [date, listMode, mealType]);

  const handleSearchError = useCallback(
    (error: unknown) => showError(error, 'Could not load foods.'),
    [showError],
  );

  const { foods, loading, refresh } = useFoodSearch(debounced, {
    enabled: category === 'foods',
    emptyQuery,
    onError: handleSearchError,
  });

  const loadMeals = useCallback(async () => {
    try {
      setMeals(await listMeals());
    } catch (error) {
      showError(error, 'Could not load meals.');
    }
  }, [showError]);

  useEffect(() => {
    if (category === 'meals') loadMeals();
  }, [category, loadMeals]);

  // Refetch favorites/recent/meals when returning from add-food or meal-builder.
  useFocusEffect(
    useCallback(() => {
      if (category === 'meals') {
        loadMeals();
      } else if (!debounced.trim() && listMode !== 'frequent') {
        refresh();
      }
    }, [category, debounced, listMode, loadMeals, refresh]),
  );

  const openFood = useCallback(
    (food: SearchFoodResult) => {
      router.push({
        pathname: '/add-food',
        params: { meal: mealType, date, productId: food.product_id },
      });
    },
    [date, mealType, router],
  );

  const handleMode = (next: LogMode) => {
    if (next === 'barcode' || next === 'camera') {
      router.push({ pathname: '/scan', params: { meal: mealType, date } });
      return;
    }
    if (next === 'more') {
      router.push({ pathname: '/create-options', params: { meal: mealType, date } });
      return;
    }
    setMode(next);
  };

  const handleLogMeal = useCallback(
    async (meal: Meal) => {
      if (loggingMealId) return;
      setLoggingMealId(meal.id);
      try {
        const { logged, skipped } = await logMealToDiary({ date, mealType, meal });
        if (logged === 0) {
          showWarning('No items in this meal could be logged.', 'Nothing logged');
        } else {
          showSuccess(
            logged === 1
              ? `Logged 1 item from "${meal.name}".`
              : `Logged ${logged} items from "${meal.name}".`,
            'Meal logged',
          );
        }
        if (skipped.length > 0) {
          showWarning(
            `Could not log: ${skipped.join(', ')}. Check your connection and try again.`,
            'Some items skipped',
          );
        }
        router.dismissAll();
      } catch (error) {
        showError(error, 'Could not log this meal.');
      } finally {
        setLoggingMealId(null);
      }
    },
    [date, loggingMealId, mealType, router, showError, showSuccess, showWarning],
  );

  const subtitles = useMemo(
    () => new Map(foods.map((food) => [food.product_id, foodSubtitle(food)])),
    [foods],
  );

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
  );

  const mealTotalsById = useMemo(() => {
    const map = new Map<string, FoodNutrients>();
    for (const meal of meals) map.set(meal.id, mealTotals(meal));
    return map;
  }, [meals]);

  const renderMeal = useCallback(
    ({ item }: { item: Meal }) => {
      const totals = mealTotalsById.get(item.id) ?? ZERO_TOTALS;
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
                pathname: '/meal-builder',
                params: { meal: mealType, date, mealId: item.id },
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
      );
    },
    [accent, colors, handleLogMeal, loggingMealId, mealTotalsById, mealType, date, router, styles],
  );

  const emptyMessage = useMemo(() => {
    if (category === 'meals') {
      return 'No meals yet. Create one and it will show up here.';
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
      <ModalContainer surface>
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

      {category === 'foods' ? (
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
      ) : null}

      <View style={styles.filters}>
        <SegmentedControl<FoodCategory>
          value={category}
          options={CATEGORY_OPTIONS}
          onChange={setCategory}
          accentColor={accent}
        />
      </View>

      {category === 'foods' && !debounced.trim() ? (
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

      {loading ? (
        <ActivityIndicator style={styles.loader} color={accent} />
      ) : null}

      {category === 'foods' ? (
        <FlatList
          style={styles.list}
          data={foods}
          keyExtractor={(item) => item.product_id}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName={foods.length === 0 && !loading ? 'grow justify-center' : undefined}
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
          data={meals}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName={meals.length === 0 && !loading ? 'grow justify-center' : undefined}
          ListHeaderComponent={
            <Pressable
              style={styles.newMealBtn}
              onPress={() =>
                router.push({ pathname: '/meal-builder', params: { meal: mealType, date } })
              }
              accessibilityRole="button"
              accessibilityLabel="Create a new meal"
            >
              <Ionicons name="restaurant" size={20} color={colors.onPrimary} />
              <Text style={styles.newMealText}>New meal</Text>
            </Pressable>
          }
          renderItem={renderMeal}
          ListEmptyComponent={
            !loading ? <Text style={styles.empty}>{emptyMessage}</Text> : null
          }
        />
      )}

      <View style={styles.footer}>
        <View style={styles.footerContext}>
          <Text style={styles.footerContextDate}>{formatDisplayDate(date)}</Text>
          <Text style={styles.footerContextMeal}>{MEAL_LABELS[mealType]}</Text>
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
      </ModalContainer>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
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
      alignItems: 'center',
      paddingTop: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    empty: {
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    newMealBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    newMealText: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
    mealRow: {
      flexDirection: 'row',
      alignItems: 'center',
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minWidth: 0,
    },
    mealIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mealInfo: { flex: 1, minWidth: 0 },
    mealName: { fontSize: 16, color: colors.text, fontWeight: '600' },
    mealMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    mealEditBtn: { padding: 4 },
    mealLogBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
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
    footerContext: { minWidth: 88 },
    footerContextDate: {
      color: colors.onPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    footerContextMeal: {
      color: colors.onPrimary,
      fontSize: 11,
      opacity: 0.85,
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
