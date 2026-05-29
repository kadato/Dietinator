import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';

type Props = {
  visible: boolean;
  message?: string;
};

export function OfflineBanner({
  visible,
  message = 'YAZIO unavailable — using cached foods',
}: Props) {
  if (!visible) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warning,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  text: { color: '#1a1a1a', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
