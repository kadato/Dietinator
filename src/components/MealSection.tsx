import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DiaryEntry, MealType } from '@/types';
import { DiaryEntryRow } from '@/components/DiaryEntryRow';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { spacing, type ColorPalette } from '@/theme';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

const MEAL_ICONS: Record<MealType, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'sunny-outline',
  lunch: 'restaurant-outline',
  dinner: 'moon-outline',
  snack: 'cafe-outline',
};

type Props = {
  mealType: MealType;
  entries: DiaryEntry[];
  mealGoal?: number;
  onAdd: () => void;
  onDelete: (id: string) => void;
};

export function MealSection({
  mealType,
  entries,
  mealGoal,
  onAdd,
  onDelete,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const mealColors: Record<MealType, string> = {
    breakfast: colors.breakfast,
    lunch: colors.lunch,
    dinner: colors.dinner,
    snack: colors.snack,
  };
  const accent = mealColors[mealType];
  const totalKcal = entries.reduce((s, e) => s + e.kcal, 0);
  const goal = mealGoal && mealGoal > 0 ? mealGoal : undefined;
  const progress = goal ? Math.min(totalKcal / goal, 1) : 0;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={[styles.iconBadge, { backgroundColor: accent + '20' }]}>
          <Ionicons name={MEAL_ICONS[mealType]} size={20} color={accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{MEAL_LABELS[mealType]}</Text>
          <Text style={styles.subtitle}>
            {goal
              ? `${Math.round(totalKcal)} / ${Math.round(goal)} kcal`
              : `${Math.round(totalKcal)} kcal`}
          </Text>
        </View>
        <Pressable
          onPress={onAdd}
          style={[styles.addBtn, { borderColor: accent }]}
          accessibilityRole="button"
          accessibilityLabel={`Add food to ${MEAL_LABELS[mealType]}`}
        >
          <Ionicons name="add" size={22} color={accent} />
        </Pressable>
      </View>

      {goal ? (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%`, backgroundColor: accent },
            ]}
          />
        </View>
      ) : null}

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No foods logged</Text>
          <Pressable onPress={onAdd} style={styles.emptyAction}>
            <Text style={[styles.emptyActionText, { color: accent }]}>
              Add food
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {entries.map((entry) => (
            <DiaryEntryRow
              key={entry.id}
              entry={entry}
              accentColor={accent}
              onDelete={() => onDelete(entry.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    section: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    iconBadge: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: { flex: 1 },
    title: { fontSize: 17, fontWeight: '700', color: colors.text },
    subtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
      fontWeight: '500',
    },
    addBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.surfaceAlt,
      overflow: 'hidden',
      marginBottom: spacing.sm,
    },
    progressFill: { height: '100%', borderRadius: 2 },
    list: { gap: 2 },
    empty: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      gap: spacing.sm,
    },
    emptyText: { fontSize: 14, color: colors.textMuted },
    emptyAction: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
    emptyActionText: { fontSize: 14, fontWeight: '600' },
  });
