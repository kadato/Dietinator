import { View, Text, StyleSheet } from 'react-native';
import { ProgressRing } from '@/components/ProgressRing';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { spacing, type ColorPalette } from '@/theme';

type Props = {
  consumed: number;
  goal: number;
};

export function CalorieRing({ consumed, goal }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const remaining = Math.max(goal - consumed, 0);
  const over = consumed > goal ? consumed - goal : 0;
  const progress = goal > 0 ? Math.min(consumed / goal, 1) : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Summary</Text>
      <View style={styles.row}>
        <View style={styles.sideStat}>
          <Text style={styles.sideValue}>{Math.round(consumed).toLocaleString()}</Text>
          <Text style={styles.sideLabel}>Eaten</Text>
        </View>

        <View style={styles.ringWrap}>
          <ProgressRing
            progress={progress}
            size={132}
            stroke={8}
            color={colors.primary}
            trackColor={colors.surfaceAlt}
          >
            <View style={styles.ringCenter}>
              <Text style={styles.remainingValue}>
                {over > 0 ? Math.round(over).toLocaleString() : Math.round(remaining).toLocaleString()}
              </Text>
              <Text style={styles.remainingLabel}>{over > 0 ? 'Over' : 'Remaining'}</Text>
            </View>
          </ProgressRing>
        </View>

        <View style={styles.sideStat}>
          <Text style={styles.sideValue}>0</Text>
          <Text style={styles.sideLabel}>Burned</Text>
        </View>
      </View>
      <Text style={styles.goalHint}>Daily goal {Math.round(goal).toLocaleString()} kcal</Text>
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      padding: spacing.lg,
      paddingBottom: 0,
    },
    sectionTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    sideStat: {
      flex: 1,
      alignItems: 'center',
      minWidth: 72,
    },
    sideValue: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    sideLabel: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 4,
      fontWeight: '500',
    },
    ringWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringCenter: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 100,
    },
    remainingValue: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    remainingLabel: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
      fontWeight: '500',
    },
    goalHint: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.md,
    },
  });
