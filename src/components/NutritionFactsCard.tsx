import { View, Text, StyleSheet } from 'react-native';
import type { FoodNutrients } from '@/types';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { spacing, type ColorPalette } from '@/theme';

type MacroRow = {
  label: string;
  value: number;
  unit: string;
  color: string;
  /** kcal per gram — keeps percentage math independent of display labels. */
  factor: number;
};

type Props = {
  nutrients: FoodNutrients;
  /** e.g. "for 150 g" or "per 100 g" */
  servingLabel: string;
};

function formatMacro(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function NutritionFactsCard({ nutrients, servingLabel }: Props) {
  const styles = useThemedStyles(createStyles);

  const macroTotal =
    nutrients.protein * 4 + nutrients.carbs * 4 + nutrients.fat * 9;
  const pct = (kcal: number) =>
    macroTotal > 0 ? Math.round((kcal / macroTotal) * 100) : 0;

  const rows: MacroRow[] = [
    {
      label: 'Protein',
      value: nutrients.protein,
      unit: 'g',
      color: styles.proteinColor.color,
      factor: 4,
    },
    {
      label: 'Carbohydrates',
      value: nutrients.carbs,
      unit: 'g',
      color: styles.carbsColor.color,
      factor: 4,
    },
    {
      label: 'Fat',
      value: nutrients.fat,
      unit: 'g',
      color: styles.fatColor.color,
      factor: 9,
    },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Nutrition facts</Text>
      <Text style={styles.servingNote}>{servingLabel}</Text>

      <View style={styles.calorieBlock}>
        <Text style={styles.calorieValue} testID="preview-kcal">
          {nutrients.kcal}
        </Text>
        <Text style={styles.calorieUnit}>kcal</Text>
      </View>

      <View style={styles.divider} />

      {rows.map((row) => (
        <View key={row.label} style={styles.macroRow}>
          <View style={styles.macroLabelWrap}>
            <View style={[styles.macroDot, { backgroundColor: row.color }]} />
            <Text style={styles.macroLabel}>{row.label}</Text>
          </View>
          <View style={styles.macroValues}>
            <Text style={styles.macroAmount}>
              {formatMacro(row.value)}
              {row.unit}
            </Text>
            <Text style={styles.macroPct}>
              {pct(row.value * row.factor)}%
            </Text>
          </View>
        </View>
      ))}

      <Text style={styles.footnote}>
        Macro percentages are share of calories from protein, carbs, and fat.
      </Text>
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
    },
    heading: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    servingNote: {
      fontSize: 14,
      color: colors.text,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    calorieBlock: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.xs,
    },
    calorieValue: {
      fontSize: 40,
      fontWeight: '800',
      color: colors.primary,
    },
    calorieUnit: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textMuted,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.md,
    },
    macroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    macroLabelWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    macroDot: { width: 8, height: 8, borderRadius: 4 },
    macroLabel: { fontSize: 15, color: colors.text, fontWeight: '500' },
    macroValues: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    macroAmount: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      minWidth: 56,
      textAlign: 'right',
    },
    macroPct: {
      fontSize: 13,
      color: colors.textMuted,
      minWidth: 36,
      textAlign: 'right',
    },
    footnote: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: spacing.sm,
      lineHeight: 16,
    },
    proteinColor: { color: colors.breakfast },
    carbsColor: { color: colors.lunch },
    fatColor: { color: colors.dinner },
  });
