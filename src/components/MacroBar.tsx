import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';

type MacroProps = {
  label: string;
  value: number;
  goal: number;
  color: string;
};

function MacroRow({ label, value, goal, color }: MacroProps) {
  const progress = goal > 0 ? Math.min(value / goal, 1) : 0;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.value}>
        {Math.round(value)}g / {Math.round(goal)}g
      </Text>
    </View>
  );
}

type Props = {
  protein: number;
  carbs: number;
  fat: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
};

export function MacroBar({ protein, carbs, fat, proteinGoal, carbsGoal, fatGoal }: Props) {
  return (
    <View style={styles.container}>
      <MacroRow label="Protein" value={protein} goal={proteinGoal} color={colors.breakfast} />
      <MacroRow label="Carbs" value={carbs} goal={carbsGoal} color={colors.lunch} />
      <MacroRow label="Fat" value={fat} goal={fatGoal} color={colors.dinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, paddingHorizontal: spacing.md },
  row: { gap: spacing.xs },
  label: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  barBg: {
    height: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  value: { fontSize: 11, color: colors.textMuted },
});
