import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CalorieRing } from '@/components/CalorieRing';
import { MacroBar } from '@/components/MacroBar';
import { MealSection } from '@/components/MealSection';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PageContainer } from '@/components/PageContainer';
import { useLayout } from '@/hooks/useLayout';
import { useApp } from '@/context/AppContext';
import type { DiaryEntry, MealType } from '@/types';
import {
  deleteFoodEntry,
  getDiaryEntriesForDate,
  getDiaryTotalsForDate,
} from '@/services/diary';
import { toDateKey, formatDisplayDate } from '@/utils/date';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { spacing, type ColorPalette } from '@/theme';

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function TodayScreen() {
  const router = useRouter();
  const { settings, yazioAvailable } = useApp();
  const { colors } = useTheme();
  const { isWide } = useLayout('wide');
  const styles = useThemedStyles(createStyles);
  const [dateKey, setDateKey] = useState(toDateKey());
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [totals, setTotals] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [list, sum] = await Promise.all([
      getDiaryEntriesForDate(dateKey),
      getDiaryTotalsForDate(dateKey),
    ]);
    setEntries(list);
    setTotals(sum);
  }, [dateKey]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const shiftDate = (delta: number) => {
    const d = new Date(dateKey);
    d.setDate(d.getDate() + delta);
    setDateKey(toDateKey(d));
  };

  const openAdd = (mealType: MealType) => {
    router.push({
      pathname: '/add-food',
      params: { meal: mealType, date: dateKey },
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const calorieRing = <CalorieRing consumed={totals.kcal} goal={settings.calorie_goal} />;
  const macroBar = (
    <MacroBar
      protein={totals.protein}
      carbs={totals.carbs}
      fat={totals.fat}
      proteinGoal={settings.protein_goal}
      carbsGoal={settings.carbs_goal}
      fatGoal={settings.fat_goal}
    />
  );
  const scanAction = (
    <View style={[styles.actions, isWide && styles.actionsWide]}>
      <Pressable style={styles.scanBtn} onPress={() => router.push('/scan')}>
        <Ionicons name="barcode-outline" size={22} color={colors.onPrimary} />
        <Text style={styles.scanText}>Scan barcode</Text>
      </Pressable>
    </View>
  );

  const meals = MEALS.map((meal) => (
    <View key={meal} style={isWide ? styles.mealCell : undefined}>
      <MealSection
        mealType={meal}
        entries={entries.filter((e) => e.meal_type === meal)}
        onAdd={() => openAdd(meal)}
        onDelete={async (id) => {
          await deleteFoodEntry(id);
          await load();
        }}
      />
    </View>
  ));

  return (
    <View style={styles.container}>
      <OfflineBanner visible={!yazioAvailable} />
      <PageContainer variant="wide" style={styles.page}>
        <View style={styles.dateRow}>
          <Pressable onPress={() => shiftDate(-1)} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.dateText}>{formatDisplayDate(dateKey)}</Text>
          <Pressable onPress={() => shiftDate(1)} hitSlop={12}>
            <Ionicons name="chevron-forward" size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          contentContainerStyle={styles.scroll}
        >
          {isWide ? (
            <>
              <View style={styles.wideSummary}>
                <View style={styles.wideSummaryCalories}>{calorieRing}</View>
                <View style={styles.wideSummaryMacros}>{macroBar}</View>
                {scanAction}
              </View>
              <View style={styles.mealGrid}>{meals}</View>
            </>
          ) : (
            <>
              {calorieRing}
              {macroBar}
              {scanAction}
              {meals}
            </>
          )}
        </ScrollView>
      </PageContainer>
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateText: { fontSize: 18, fontWeight: '600', color: colors.text },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  wideSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  wideSummaryCalories: {
    flexShrink: 0,
    minWidth: 220,
  },
  wideSummaryMacros: {
    flex: 1,
    minWidth: 260,
  },
  actionsWide: {
    marginVertical: 0,
    flexShrink: 0,
    minWidth: 180,
    alignSelf: 'center',
  },
  mealGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  mealCell: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 300,
  },
  actions: { marginVertical: spacing.md, flexGrow: 1, minWidth: 200 },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: spacing.md,
    alignSelf: 'stretch',
  },
  scanText: { color: colors.onPrimary, fontWeight: '700', fontSize: 16, flexShrink: 0 },
});
