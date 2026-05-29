import type { ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useLayout, type LayoutVariant } from '@/hooks/useLayout';

type Props = {
  children: ReactNode;
  variant?: LayoutVariant;
  /** When false, inner content does not expand (use inside ScrollView). */
  grow?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export function PageContainer({
  children,
  variant = 'default',
  grow = true,
  style,
  contentStyle,
}: Props) {
  const { contentMaxWidth } = useLayout(variant);

  return (
    <View style={[styles.outer, style]}>
      <View
        style={[
          styles.inner,
          grow && styles.innerGrow,
          { maxWidth: contentMaxWidth },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  inner: {
    width: '100%',
  },
  innerGrow: {
    flex: 1,
  },
});
