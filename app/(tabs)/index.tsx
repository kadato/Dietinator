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
import { useApp } from '@/context/AppContext';
import { importDiaryFromYazio, type MealGoals } from '@/services/yazio/sync';
import { useToast } from '@/context/ToastContext';
import type { DiaryEntry, MealType } from '@/types';
import { deleteFoodEntry, getDiaryEntriesForDate } from '@/services/diary';
import { toDateKey, formatDisplayDate } from '@/utils/date';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { spacing, type ColorPalette } from '@/theme';

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function TodayScreen() {
  const router = useRouter();
  const { settings, yazioAvailable, authenticated } = useApp();
  const { showError, showSuccess, showWarning } = useToast();
  const { colors } = useTheme();
  const { isWide } = useLayout();
  const styles = useThemedStyles(createStyles);
  const [dateKey, setDateKey] = useState(toDateKey());
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [totals, setTotals] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mealGoals, setMealGoals] = useState<MealGoals>({});

  const load = useCallback(
    async (options?: { quiet?: boolean }) => {
      try {
        if (authenticated) {
          setImporting(true);
          const result = await importDiaryFromYazio(dateKey);
          setMealGoals(result.mealGoals);
          if (result.error && !options?.quiet) {
            showWarning(result.error, 'YAZIO import');
          } else if (
            !options?.quiet &&
            result.imported > 0 &&
            result.failed === 0
          ) {
            showSuccess(
              result.imported === 1
                ? 'Imported 1 item from YAZIO.'
                : `Imported ${result.imported} items from YAZIO.`,
              'Synced',
            );
          } else if (!options?.quiet && result.failed > 0) {
            showWarning(
              `${result.imported} imported, ${result.failed} could not be loaded. Try again.`,
              'Partial import',
            );
          }
        }
        const list = await getDiaryEntriesForDate(dateKey);
        setEntries(list);
        setTotals(
          list.reduce(
            (acc, e) => ({
              kcal: acc.kcal + e.kcal,
              protein: acc.protein + e.protein,
              carbs: acc.carbs + e.carbs,
              fat: acc.fat + e.fat,
            }),
            { kcal: 0, protein: 0, carbs: 0, fat: 0 },
          ),
        );
      } catch (error) {
        showError(error, 'Could not load diary for this day.');
      } finally {
        setImporting(false);
      }
    },
    [authenticated, dateKey, showError, showSuccess, showWarning],
  );

  useEffect(() => {
    load({ quiet: true });
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load({ quiet: true });
    }, [load]),
  );

  const shiftDate = (delta: number) => {
    const d = new Date(dateKey);
    d.setDate(d.getDate() + delta);
    setDateKey(toDateKey(d));
  };

  const openAdd = (mealType: MealType) => {
    router.push({
      pathname: '/(tabs)/search',
      params: { meal: mealType, date: dateKey },
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onDeleteEntry = async (id: string) => {
    try {
      await deleteFoodEntry(id);
      await load({ quiet: true });
    } catch (error) {
      showError(error, 'Could not delete entry.');
    }
  };

  const renderMealSections = (grid?: boolean) =>
    MEALS.map((meal) => {
      const section = (
        <MealSection
          key={meal}
          mealType={meal}
          entries={entries.filter((e) => e.meal_type === meal)}
          mealGoal={mealGoals[meal]}
          onAdd={() => openAdd(meal)}
          onDelete={onDeleteEntry}
        />
      );
      return grid ? (
        <View key={meal} style={styles.mealGridItem}>
          {section}
        </View>
      ) : (
        section
      );
    });

  return (
    <View style={styles.container}>
      <OfflineBanner visible={!yazioAvailable} />
      <PageContainer variant={isWide ? 'wide' : 'narrow'} style={styles.page}>
        <View style={styles.dateRow}>
          <Pressable onPress={() => shiftDate(-1)} hitSlop={12} style={styles.dateNav}>
            <Ionicons name="chevron-back" size={24} color={colors.textOnBackground} />
          </Pressable>
          <Text style={styles.dateText}>{formatDisplayDate(dateKey)}</Text>
          <View style={styles.dateNavGroup}>
            <Pressable onPress={() => shiftDate(1)} hitSlop={12} style={styles.dateNav}>
              <Ionicons name="chevron-forward" size={24} color={colors.textOnBackground} />
            </Pressable>
            {authenticated ? (
              <Pressable
                onPress={() => load()}
                disabled={importing || refreshing}
                style={styles.syncBtn}
                accessibilityRole="button"
                accessibilityLabel="Refresh from YAZIO"
              >
                <Ionicons
                  name="cloud-download-outline"
                  size={22}
                  color={importing ? colors.textMuted : colors.textOnBackground}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          contentContainerStyle={[styles.scroll, isWide && styles.scrollWide]}
        >
          {isWide ? (
            <View style={styles.wideLayout}>
              <View style={styles.summaryColumn}>
                <View style={styles.summaryCard}>
                  <CalorieRing consumed={totals.kcal} goal={settings.calorie_goal} />
                  <MacroBar
                    protein={totals.protein}
                    carbs={totals.carbs}
                    fat={totals.fat}
                    proteinGoal={settings.protein_goal}
                    carbsGoal={settings.carbs_goal}
                    fatGoal={settings.fat_goal}
                  />
                </View>
              </View>

              <View style={styles.mealsColumn}>
                <View style={styles.nutritionHeader}>
                  <Text style={styles.nutritionTitle}>Nutrition</Text>
                  <Pressable
                    style={styles.scanBtn}
                    onPress={() => router.push('/scan')}
                    accessibilityRole="button"
                    accessibilityLabel="Scan barcode"
                  >
                    <Ionicons name="barcode-outline" size={20} color={colors.onPrimary} />
                  </Pressable>
                </View>

                <View style={styles.mealsGrid}>{renderMealSections(true)}</View>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.summaryCard}>
                <CalorieRing consumed={totals.kcal} goal={settings.calorie_goal} />
                <MacroBar
                  protein={totals.protein}
                  carbs={totals.carbs}
                  fat={totals.fat}
                  proteinGoal={settings.protein_goal}
                  carbsGoal={settings.carbs_goal}
                  fatGoal={settings.fat_goal}
                />
              </View>

              <View style={styles.nutritionHeader}>
                <Text style={styles.nutritionTitle}>Nutrition</Text>
                <Pressable
                  style={styles.scanBtn}
                  onPress={() => router.push('/scan')}
                  accessibilityRole="button"
                  accessibilityLabel="Scan barcode"
                >
                  <Ionicons name="barcode-outline" size={20} color={colors.onPrimary} />
                </Pressable>
              </View>

              {renderMealSections()}
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
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.background,
    },
    dateNav: { width: 36, alignItems: 'center' },
    dateNavGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      width: 72,
      justifyContent: 'flex-end',
    },
    dateText: {
      flex: 1,
      fontSize: 17,
      fontWeight: '600',
      color: colors.textOnBackground,
      textAlign: 'center',
    },
    syncBtn: { padding: spacing.xs, marginLeft: spacing.xs },
    scroll: {
      padding: spacing.md,
      paddingBottom: spacing.xl * 2,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    scrollWide: {
      maxWidth: undefined,
      alignSelf: 'stretch',
      paddingHorizontal: spacing.lg,
    },
    wideLayout: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.lg,
      width: '100%',
    },
    summaryColumn: {
      flex: 0.9,
      minWidth: 320,
      maxWidth: 420,
    },
    mealsColumn: {
      flex: 1.1,
      minWidth: 0,
    },
    mealsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    mealGridItem: {
      flexGrow: 1,
      flexBasis: '48%',
      minWidth: 280,
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    nutritionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    nutritionTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textOnBackground,
    },
    scanBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
