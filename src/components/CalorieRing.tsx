import { View, Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { spacing, type ColorPalette } from '@/theme';

type Props = {
  consumed: number;
  goal: number;
};

export function CalorieRing({ consumed, goal }: Props) {
  const styles = useThemedStyles(createStyles);
  const remaining = Math.max(goal - consumed, 0);
  const over = consumed > goal ? consumed - goal : 0;
  const progress = goal > 0 ? Math.min(consumed / goal, 1) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.ringOuter}>
        <View style={[styles.ringFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(consumed)}</Text>
          <Text style={styles.statLabel}>Eaten</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, over > 0 && styles.statOver]}>
            {over > 0 ? Math.round(over) : Math.round(remaining)}
          </Text>
          <Text style={styles.statLabel}>{over > 0 ? 'Over' : 'Left'}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(goal)}</Text>
          <Text style={styles.statLabel}>Goal</Text>
        </View>
      </View>
      <Text style={styles.unitHint}>kilocalories (kcal)</Text>
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    ringOuter: {
      width: '100%',
      height: 10,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 5,
      overflow: 'hidden',
      marginBottom: spacing.lg,
    },
    ringFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 5,
    },
    stats: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      width: '100%',
      maxWidth: 360,
    },
    stat: { flex: 1, alignItems: 'center' },
    statDivider: {
      width: 1,
      height: 36,
      backgroundColor: colors.border,
      marginHorizontal: spacing.sm,
    },
    statValue: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
    },
    statOver: { color: colors.warning },
    statLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    unitHint: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: spacing.md,
    },
  });
