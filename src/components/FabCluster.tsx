import type { ReactNode } from "react"
import { View } from "react-native"

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
 * (content-sized), never a full-screen wrapper — a full-screen overlay with
 * `pointerEvents: "box-none"` in an inline style is dropped by
 * react-native-web, which would block every tap on web.
 *
 * Replaces the hand-rolled `fabLayer` / `fabLeft` / `fabRight` wrappers that
 * drifted across screens (right: 20 vs 24, bottom: +16 vs +24).
 */
export function FabCluster({ left, right, bottomOffset = 20, gap = 12, insetX = 20 }: Props) {
  return (
    <>
      {left ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: insetX,
            bottom: bottomOffset,
            alignItems: "flex-start",
            gap,
          }}
        >
          {left}
        </View>
      ) : null}
      {right ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            right: insetX,
            bottom: bottomOffset,
            alignItems: "flex-end",
            gap,
          }}
        >
          {right}
        </View>
      ) : null}
    </>
  )
}
