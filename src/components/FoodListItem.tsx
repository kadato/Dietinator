import { Pressable, Text, StyleSheet, View } from 'react-native';
import type { SearchFoodResult } from '@/types';
import { formatListNutrientLine } from '@/utils/food-display';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { spacing, type ColorPalette } from '@/theme';

type Props = {
  food: SearchFoodResult;
  onPress: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  subtitle?: string;
};

export function FoodListItem({
  food,
  onPress,
  onToggleFavorite,
  isFavorite,
  subtitle,
}: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {food.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {subtitle ?? formatListNutrientLine(food)}
        </Text>
      </View>
      {onToggleFavorite && (
        <Pressable onPress={onToggleFavorite} hitSlop={8}>
          <Text style={styles.star}>{isFavorite ? '★' : '☆'}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    info: { flex: 1 },
    name: { fontSize: 16, color: colors.text, fontWeight: '500' },
    meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    star: { fontSize: 22, color: colors.warning, paddingLeft: spacing.sm },
  });
