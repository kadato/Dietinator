import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';

type Props = {
  consumed: number;
  goal: number;
};

export function CalorieRing({ consumed, goal }: Props) {
  const remaining = Math.max(goal - consumed, 0);
  const progress = goal > 0 ? Math.min(consumed / goal, 1) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.ringOuter}>
        <View style={[styles.ringFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.consumed}>{Math.round(consumed)}</Text>
      <Text style={styles.label}>kcal eaten</Text>
      <Text style={styles.remaining}>{Math.round(remaining)} left of {goal}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: spacing.lg },
  ringOuter: {
    width: '100%',
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  ringFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  consumed: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.text,
  },
  label: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  remaining: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
