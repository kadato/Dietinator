import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CalorieRing } from '@/components/CalorieRing';
import { MacroBar } from '@/components/MacroBar';
import { MealSection } from '@/components/MealSection';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PageContainer } from '@/components/PageContainer';
import { DatePickerModal } from '@/components/DatePickerModal';
import { useApp } from '@/context/AppContext';
import { importDiaryFromYazio, type MealGoals, type YazioDailySummary } from '@/services/yazio/sync';
import { useToast } from '@/context/ToastContext';
import type { DiaryEntry, MealType } from '@/types';
import { deleteFoodEntry, getDiaryEntriesForDate } from '@/services/diary';
import { confirmAction } from '@/utils/confirm';
import { shiftDateKey, toDateKey, formatDisplayDate } from '@/utils/date';
import { useLayout } from '@/hooks/useLayout';
import { useTheme } from '@/hooks/useTheme';
import { Box } from '@ui/box';
import { Text } from '@ui/text';
import { Card } from '@ui/card';

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function sumEntries(list: DiaryEntry[]) {
  return list.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const { settings, yazioAvailable, authenticated } = useApp();
  const { showError, showSuccess, showWarning } = useToast();
  const { colors } = useTheme();
  const { isWide } = useLayout();
  const [dateKey, setDateKey] = useState(toDateKey());
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [totals, setTotals] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mealGoals, setMealGoals] = useState<MealGoals>({});
  const [summary, setSummary] = useState<YazioDailySummary | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(
    async (options?: { quiet?: boolean }) => {
      // 1. Local first — the diary renders from SQLite before any network is touched.
      let list: DiaryEntry[];
      try {
        list = await getDiaryEntriesForDate(dateKey);
        setEntries(list);
        setTotals(sumEntries(list));
      } catch (error) {
        showError(error, 'Could not load diary for this day.');
        return;
      }

      // 2. Background sync — imports and goals refresh without blocking the render.
      if (!authenticated) return;
      setImporting(true);
      try {
        const result = await importDiaryFromYazio(dateKey);
        setMealGoals(result.mealGoals);
        setSummary(result.summary);
        if (result.imported > 0 || result.failed > 0 || result.error) {
          const updated = await getDiaryEntriesForDate(dateKey);
          setEntries(updated);
          setTotals(sumEntries(updated));
        }
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
      } catch {
        // Import errors are reported inside importDiaryFromYazio; never block the UI here.
      } finally {
        setImporting(false);
      }
    },
    [authenticated, dateKey, showError, showSuccess, showWarning],
  );

  useFocusEffect(
    useCallback(() => {
      load({ quiet: true });
    }, [load]),
  );

  const shiftDate = (delta: number) => {
    setDateKey((current) => shiftDateKey(current, delta));
  };

  const openAdd = (mealType: MealType) => {
    router.push({
      pathname: '/log-meal',
      params: { meal: mealType, date: dateKey },
    });
  };

  const openEdit = (entryId: string) => {
    router.push({
      pathname: '/add-food',
      params: { entryId, date: dateKey },
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onDeleteEntry = async (id: string) => {
    const entry = entries.find((e) => e.id === id);
    confirmAction({
      title: 'Delete entry?',
      message: `Remove "${entry?.food_name ?? 'this item'}" from the diary?`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await deleteFoodEntry(id);
          await load({ quiet: true });
        } catch (error) {
          showError(error, 'Could not delete entry.');
        }
      },
    });
  };

  const renderMealSections = (grid?: boolean) =>
    MEALS.map((meal) => {
      const section = (
        <MealSection
          key={`${dateKey}-${meal}`}
          mealType={meal}
          dateKey={dateKey}
          entries={entries.filter((e) => e.meal_type === meal)}
          mealGoal={mealGoals[meal]}
          onAdd={() => openAdd(meal)}
          onEdit={openEdit}
          onDelete={onDeleteEntry}
        />
      );
      return grid ? (
        <View key={meal} className="grow basis-[48%] min-w-[280px]">
          {section}
        </View>
      ) : (
        section
      );
    });

  const isToday = dateKey === toDateKey();
  const weight = summary?.weight;

  const summaryCard = (
    <Card variant="elevated" className="mb-6 overflow-hidden">
      <CalorieRing
        consumed={totals.kcal}
        goal={settings.calorie_goal}
        burned={summary?.activityEnergy ?? 0}
      />
      <MacroBar
        protein={totals.protein}
        carbs={totals.carbs}
        fat={totals.fat}
        proteinGoal={settings.protein_goal}
        carbsGoal={settings.carbs_goal}
        fatGoal={settings.fat_goal}
      />
      {summary && (summary.steps > 0 || summary.waterIntake > 0 || weight) ? (
        <Box className="flex-row items-center justify-around border-t border-outline-200 px-2 py-3">
          {summary.steps > 0 ? (
            <Box className="flex-row items-center gap-1.5">
              <Ionicons name="footsteps-outline" size={16} color={colors.primary} />
              <Text size="sm" className="text-typography-900">
                {summary.steps.toLocaleString()}
              </Text>
            </Box>
          ) : null}
          {summary.waterIntake > 0 ? (
            <Box className="flex-row items-center gap-1.5">
              <Ionicons name="water-outline" size={16} color={colors.primary} />
              <Text size="sm" className="text-typography-900">
                {summary.waterGoal > 0
                  ? `${Math.round(summary.waterIntake / 100) / 10} / ${Math.round(summary.waterGoal / 100) / 10} L`
                  : `${Math.round(summary.waterIntake / 100) / 10} L`}
              </Text>
            </Box>
          ) : null}
          {weight ? (
            <Box className="flex-row items-center gap-1.5">
              <Ionicons name="scale-outline" size={16} color={colors.primary} />
              <Text size="sm" className="text-typography-900">
                {weight} kg
              </Text>
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Card>
  );

  const nutritionHeader = (
    <Box className="flex-row items-center justify-between mb-4 px-1">
      <Box>
        <Text size="2xl" bold style={{ color: colors.textOnBackground }}>
          Meals
        </Text>
        <Text size="sm" style={{ color: colors.textMuted }} className="mt-0.5">
          Tap + to log food
        </Text>
      </Box>
      <Pressable
        className="h-11 flex-row items-center gap-1.5 rounded-full bg-primary-500 px-4 active:opacity-85"
        onPress={() =>
          router.push({ pathname: '/scan', params: { meal: 'lunch', date: dateKey } })
        }
        accessibilityRole="button"
        accessibilityLabel="Scan barcode"
      >
        <Ionicons name="barcode-outline" size={20} color={colors.onPrimary} />
        <Text size="sm" bold style={{ color: colors.onPrimary }}>
          Scan
        </Text>
      </Pressable>
    </Box>
  );

  return (
    <Box className="flex-1 bg-background-0">
      <OfflineBanner visible={!yazioAvailable} />
      <PageContainer variant={isWide ? 'wide' : 'narrow'} className="flex-1">
        <Box className="px-4 pt-3 pb-2">
          <Card variant="elevated" className="flex-row items-center px-2 py-2">
            <Pressable
              onPress={() => shiftDate(-1)}
              hitSlop={12}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-background-100"
              accessibilityRole="button"
              accessibilityLabel="Previous day"
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Pressable
              className="flex-1 items-center py-0.5"
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open calendar"
            >
              <Text size="md" bold className="text-typography-900">
                {formatDisplayDate(dateKey)}
              </Text>
              {!isToday ? (
                <Box className="mt-1 px-3 py-0.5 rounded-full bg-primary-500/15">
                  <Text size="2xs" bold className="text-primary-600">
                    Jump to today
                  </Text>
                </Box>
              ) : null}
            </Pressable>
            <Box className="flex-row items-center">
              <Pressable
                onPress={() => shiftDate(1)}
                hitSlop={12}
                className="h-10 w-10 items-center justify-center rounded-full active:bg-background-100"
                accessibilityRole="button"
                accessibilityLabel="Next day"
              >
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </Pressable>
              {authenticated ? (
                <Pressable
                  onPress={() => load()}
                  disabled={importing || refreshing}
                  className="h-10 w-10 items-center justify-center rounded-full active:bg-background-100"
                  accessibilityRole="button"
                  accessibilityLabel="Refresh from YAZIO"
                >
                  <Ionicons
                    name="cloud-download-outline"
                    size={20}
                    color={importing ? colors.textMuted : colors.primary}
                  />
                </Pressable>
              ) : (
                <Box className="w-10" />
              )}
            </Box>
          </Card>
        </Box>

        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          contentContainerClassName={`p-4 pb-16 w-full ${isWide ? 'self-stretch max-w-none px-6' : 'self-center'}`}
        >
          {isWide ? (
            <Box className="flex-row items-start gap-6 w-full">
              <Box className="flex-[0.9] min-w-[320px] max-w-[420px]">{summaryCard}</Box>
              <Box className="flex-[1.1] min-w-0">
                {nutritionHeader}
                <Box className="flex-row flex-wrap gap-2">{renderMealSections(true)}</Box>
              </Box>
            </Box>
          ) : (
            <>
              {summaryCard}
              {nutritionHeader}
              {renderMealSections()}
            </>
          )}
        </ScrollView>
      </PageContainer>

      <DatePickerModal
        visible={pickerOpen}
        dateKey={dateKey}
        onSelect={(key) => setDateKey(key)}
        onClose={() => setPickerOpen(false)}
      />
    </Box>
  );
}
