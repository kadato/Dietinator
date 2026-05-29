import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';

type Props = {
  progress: number;
  size: number;
  stroke?: number;
  color: string;
  trackColor: string;
  children?: ReactNode;
};

/**
 * Simple circular progress (0–1) without extra dependencies.
 * Uses quadrant border fills rotated from the top.
 */
export function ProgressRing({
  progress,
  size,
  stroke = 3,
  color,
  trackColor,
  children,
}: Props) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const radius = size / 2;
  const deg = clamped * 360;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: stroke,
          borderColor: trackColor,
        }}
      />
      {clamped > 0 ? (
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth: stroke,
            borderColor: color,
            borderRightColor: deg > 90 ? color : trackColor,
            borderBottomColor: deg > 180 ? color : trackColor,
            borderLeftColor: deg > 270 ? color : trackColor,
            transform: [{ rotate: '-90deg' }],
          }}
        />
      ) : null}
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
