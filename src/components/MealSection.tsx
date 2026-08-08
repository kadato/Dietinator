import { memo, useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DiaryEntry, MealType } from '@/types';
import { DiaryEntryRow } from '@/components/DiaryEntryRow';
import { ProgressRing } from '@/components/ProgressRing';
import { MEAL_LABELS, MEAL_ICONS } from '@/utils/meals';
import { Box } from '@ui/box';
import { Text } from '@ui/text';
import { Card } from '@ui/card';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  mealType: MealType;
  entries: DiaryEntry[];
  mealGoal?: number;
  /** Changes with the selected date so expanded state resets between days. */
  dateKey: string;
  onAdd: (mealType: MealType) => void;
  onEdit: (entryId: string) => void;
  onDelete: (id: string) => void;
};

function formatFoodPreview(entries: DiaryEntry[]): string {
  if (entries.length === 0) return 'No foods logged yet';
  const names = entries.map((e) => e.food_name);
  const joined = names.join(', ');
  return joined.length > 72 ? `${joined.slice(0, 69)}…` : joined;
}

export const MealSection = memo(function MealSection({
  mealType,
  entries,
  mealGoal,
  dateKey,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const handleEdit = useCallback((entryId: string) => onEdit(entryId), [onEdit]);
  const handleDelete = useCallback((entryId: string) => onDelete(entryId), [onDelete]);
  const accent = colors[mealType];
  const totalKcal = entries.reduce((s, e) => s + e.kcal, 0);
  const goal = mealGoal && mealGoal > 0 ? mealGoal : undefined;
  const progress = goal ? Math.min(totalKcal / goal, 1) : 0;
  const calorieLabel = goal
    ? `${Math.round(totalKcal)} / ${Math.round(goal)} Cal`
    : `${Math.round(totalKcal)} Cal`;

  return (
    <Card
      variant="elevated"
      className="p-4 mb-3 overflow-hidden"
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <Box className="flex-row items-start gap-3">
        <Pressable
          onPress={() => entries.length > 0 && setExpanded((v) => !v)}
          disabled={entries.length === 0}
          className="flex-1 flex-row items-start gap-3 min-w-0 active:opacity-90"
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

          <Box className="flex-1 min-w-0 pt-0.5">
            <Text size="lg" bold className="text-typography-900">
              {MEAL_LABELS[mealType]}
            </Text>
            <Text size="sm" bold className="text-typography-500 mt-0.5">
              {calorieLabel}
            </Text>
            <Text size="sm" className="text-typography-500 mt-1.5 leading-[18px]" numberOfLines={expanded ? undefined : 2}>
              {formatFoodPreview(entries)}
            </Text>
          </Box>
        </Pressable>

        <Pressable
          className="h-10 w-10 rounded-full bg-primary-500 items-center justify-center mt-1 active:opacity-80"
          onPress={() => onAdd(mealType)}
          accessibilityRole="button"
          accessibilityLabel={`Add food to ${MEAL_LABELS[mealType]}`}
        >
          <Ionicons name="add" size={24} color={colors.onPrimary} />
        </Pressable>
      </Box>

      {expanded && entries.length > 0 ? (
        <Box className="mt-4 pt-4 border-t border-outline-200 gap-0.5">
          {entries.map((entry) => (
            <DiaryEntryRow
              key={`${dateKey}-${entry.id}`}
              entry={entry}
              accentColor={accent}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
          <Text size="2xs" className="text-typography-500 text-center mt-2">
            Tap to edit · Long-press to delete
          </Text>
        </Box>
      ) : null}
    </Card>
  );
});
