import { View, Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { spacing, type ColorPalette } from '@/theme';

type Props = {
  visible: boolean;
  message?: string;
};

export function OfflineBanner({
  visible,
  message = 'YAZIO unavailable — using cached foods',
}: Props) {
  const styles = useThemedStyles(createStyles);

  if (!visible) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    banner: {
      backgroundColor: colors.warning,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    text: { color: colors.onWarning, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  });
