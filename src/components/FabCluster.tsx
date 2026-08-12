import type { ReactNode } from "react"
import { StyleSheet, View } from "react-native"

/**
 * `pointerEvents` must live in a registered style, not an inline one —
 * react-native-web only compiles it from `StyleSheet.create`, and inline
 * `{ pointerEvents: "box-none" }` is silently dropped on web.
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
})

type Props = {
  /** FABs docked to the bottom-left of the screen. */
  left?: ReactNode
  /** FABs docked to the bottom-right of the screen. */
  right?: ReactNode
  /** Distance from the bottom edge (safe area already included by callers). */
  bottomOffset?: number
  /** Vertical gap between stacked FABs. */
  gap?: number
  /** Horizontal inset from the screen edge. */
  insetX?: number
}

/**
 * Docks FABs to the bottom corners. Renders only the corner clusters
 * (content-sized), never a full-screen wrapper, so taps outside the cluster
 * reach the screen below on every platform.
 *
 * Replaces the hand-rolled `fabLayer` / `fabLeft` / `fabRight` wrappers that
 * drifted across screens (right: 20 vs 24, bottom: +16 vs +24).
 */
export function FabCluster({ left, right, bottomOffset = 20, gap = 12, insetX = 20 }: Props) {
  return (
    <>
      {left ? (
        <View style={[styles.cluster, { left: insetX, bottom: bottomOffset, gap }]}>{left}</View>
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
