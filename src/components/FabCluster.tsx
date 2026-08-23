import type { ReactNode } from "react"
import { StyleSheet, View } from "react-native"

/**
 * Pass `pointerEvents` as a prop, not a style. react-native-web
 * drops it from inline styles and from css-interop-processed StyleSheet
 * output. Verified live, computed style stayed auto. RN 0.85 deprecates
 * the prop in favor of the style, but only the prop actually reaches CSS
 * through NativeWind, so the warning is accepted over silent breakage.
 */
const styles = StyleSheet.create({
  cluster: {
    position: "absolute",
    alignItems: "flex-start",
    gap: 12,
    pointerEvents: "box-none",
  },
  clusterRight: {
    alignItems: "flex-end",
  },
  clusterCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "box-none",
  },
})

type Props = {
  /** FABs docked to the bottom-left of the screen. */
  left?: ReactNode
  /** FABs docked to the bottom-right of the screen. */
  right?: ReactNode
  /** FABs docked bottom-center, thumb-friendly on phones. */
  center?: ReactNode
  /** Distance from the bottom edge. Safe area already included by callers. */
  bottomOffset?: number
  /** Vertical gap between stacked FABs. */
  gap?: number
  /** Horizontal inset from the screen edge. */
  insetX?: number
}

/**
 * Docks FABs to the bottom corners or bottom-center. Renders only the
 * clusters, content-sized, never a full-screen wrapper, so taps outside the
 * cluster reach the screen below on every platform.
 */
export function FabCluster({
  left,
  right,
  center,
  bottomOffset = 20,
  gap = 12,
  insetX = 20,
}: Props) {
  return (
    <>
      {left ? (
        <View style={[styles.cluster, { left: insetX, bottom: bottomOffset, gap }]}>{left}</View>
      ) : null}
      {center ? (
        // Prop form, not style: react-native-web drops `pointerEvents` from
        // both inline and css-interop-processed styles, and a full-width
        // center cluster would swallow every tap above it.
        <View
          pointerEvents="box-none"
          style={[styles.clusterCenter, { bottom: bottomOffset, gap }]}
        >
          {center}
        </View>
      ) : null}
      {right ? (
        <View
          style={[
            styles.cluster,
            styles.clusterRight,
            { right: insetX, bottom: bottomOffset, gap },
          ]}
        >
          {right}
        </View>
      ) : null}
    </>
  )
}
