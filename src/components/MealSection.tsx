import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { DiaryEntry, MealType } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { spacing, type ColorPalette } from '@/theme';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

type Props = {
  mealType: MealType;
  entries: DiaryEntry[];
  onAdd: () => void;
  onDelete: (id: string) => void;
};

export function MealSection({ mealType, entries, onAdd, onDelete }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const mealColors: Record<MealType, string> = {
    breakfast: colors.breakfast,
    lunch: colors.lunch,
    dinner: colors.dinner,
    snack: colors.snack,
  };
  const totalKcal = entries.reduce((s, e) => s + e.kcal, 0);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: mealColors[mealType] }]} />
        <Text style={styles.title}>{MEAL_LABELS[mealType]}</Text>
        <Text style={styles.total}>{Math.round(totalKcal)} kcal</Text>
        <Pressable onPress={onAdd} style={styles.addBtn}>
          <Text style={styles.addText}>+</Text>
        </Pressable>
      </View>
      {entries.length === 0 ? (
        <Text style={styles.empty}>No foods logged</Text>
      ) : (
        entries.map((entry) => (
          <Pressable
            key={entry.id}
            onLongPress={() => onDelete(entry.id)}
            style={styles.entry}
          >
            <View style={styles.entryInfo}>
              <Text style={styles.entryName}>{entry.food_name}</Text>
              <Text style={styles.entryMeta}>
                {entry.amount}
                {entry.unit} · P {entry.protein}g · C {entry.carbs}g · F {entry.fat}g
              </Text>
            </View>
            <Text style={styles.entryKcal}>{Math.round(entry.kcal)}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    section: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
    title: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
    total: { fontSize: 13, color: colors.textMuted, marginRight: spacing.sm },
    addBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addText: { color: colors.primary, fontSize: 18, fontWeight: '600' },
    empty: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
    entry: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    entryInfo: { flex: 1 },
    entryName: { fontSize: 15, color: colors.text, fontWeight: '500' },
    entryMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    entryKcal: { fontSize: 15, fontWeight: '600', color: colors.primary },
  });
