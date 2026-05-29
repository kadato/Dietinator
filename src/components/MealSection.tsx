import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DiaryEntry, MealType } from '@/types';
import { DiaryEntryRow } from '@/components/DiaryEntryRow';
import { ProgressRing } from '@/components/ProgressRing';
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

function formatFoodPreview(entries: DiaryEntry[]): string {
  if (entries.length === 0) return 'No foods logged yet';
  const names = entries.map((e) => e.food_name);
  const joined = names.join(', ');
  return joined.length > 72 ? `${joined.slice(0, 69)}…` : joined;
}

export function MealSection({
  mealType,
  entries,
  mealGoal,
  onAdd,
  onDelete,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState(false);
  const mealColors: Record<MealType, string> = {
    breakfast: colors.breakfast,
    lunch: colors.lunch,
    dinner: colors.dinner,
    snack: colors.snack,
  };
  const accent = mealColors[mealType];
  const totalKcal = entries.reduce((s, e) => s + e.kcal, 0);
  const goal = mealGoal && mealGoal > 0 ? mealGoal : undefined;
  const progress = goal ? Math.min(totalKcal / goal, 1) : totalKcal > 0 ? 0.35 : 0;
  const calorieLabel = goal
    ? `${Math.round(totalKcal)} / ${Math.round(goal)} Cal`
    : `${Math.round(totalKcal)} Cal`;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Pressable
          onPress={() => entries.length > 0 && setExpanded((v) => !v)}
          disabled={entries.length === 0}
          style={({ pressed }) => [
            styles.headerTap,
            pressed && entries.length > 0 && styles.headerPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${MEAL_LABELS[mealType]}, ${calorieLabel}`}
        >
          <ProgressRing
            progress={progress}
            size={48}
            stroke={3}
            color={accent}
            trackColor={colors.surfaceAlt}
          >
            <Ionicons name={MEAL_ICONS[mealType]} size={20} color={accent} />
          </ProgressRing>

          <View style={styles.headerText}>
            <Text style={styles.title}>{MEAL_LABELS[mealType]}</Text>
            <Text style={styles.subtitle}>{calorieLabel}</Text>
            <Text style={styles.preview} numberOfLines={expanded ? undefined : 2}>
              {formatFoodPreview(entries)}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={onAdd}
          style={styles.addBtn}
          accessibilityRole="button"
          accessibilityLabel={`Add food to ${MEAL_LABELS[mealType]}`}
        >
          <Ionicons name="add" size={24} color={colors.onPrimary} />
        </Pressable>
      </View>

      {expanded && entries.length > 0 ? (
        <View style={styles.list}>
          {entries.map((entry) => (
            <DiaryEntryRow
              key={entry.id}
              entry={entry}
              accentColor={accent}
              onDelete={() => onDelete(entry.id)}
            />
          ))}
          <Text style={styles.hint}>Long-press an item to delete</Text>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    section: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    headerTap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      minWidth: 0,
    },
    headerPressed: { opacity: 0.92 },
    headerText: { flex: 1, minWidth: 0, paddingTop: 2 },
    title: { fontSize: 17, fontWeight: '700', color: colors.text },
    subtitle: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 2,
      fontWeight: '600',
    },
    preview: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 6,
      lineHeight: 18,
    },
    addBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      marginTop: 4,
    },
    list: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 2,
    },
    hint: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
  });
