import { useEffect, useState } from "react"
import { StyleSheet, View, type ViewStyle } from "react-native"
import { useTheme } from "@/hooks/useTheme"

const EDGES = ["top", "right", "bottom", "left"] as const
type Edge = (typeof EDGES)[number]
/** One revolution every 640ms; each edge holds for 160ms. */
export const SPINNER_STEP_MS = 160

/**
 * Field-terminal loader shared by every surface: a static square well whose
 * outline is the track while exactly one edge is inked at a time. The inked
 * edge steps around the perimeter. Nothing rotates.
 */
export function LoadingSpinner({ size = 32 }: { size?: number }) {
  const { colors } = useTheme()
  const [step, setStep] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => (s + 1) % EDGES.length)
    }, SPINNER_STEP_MS)
    return () => clearInterval(timer)
  }, [])

  const active = EDGES[step]

  return (
    <View
      style={[
        styles.track,
        {
          width: size,
          height: size,
          borderColor: colors.surfaceAlt,
        },
      ]}
      accessibilityLabel="Loading"
    >
      {EDGES.map((edge) =>
        edge === active ? (
          <View
            key={edge}
            style={[styles.edge, EDGE_GEOMETRY[edge], { backgroundColor: colors.primary }]}
          />
        ) : null,
      )}
    </View>
  )
}

const EDGE_GEOMETRY: Record<Edge, ViewStyle> = {
  top: { top: 0, left: 0, right: 0, height: 2 },
  right: { top: 0, bottom: 0, right: 0, width: 2 },
  bottom: { bottom: 0, left: 0, right: 0, height: 2 },
  left: { top: 0, bottom: 0, left: 0, width: 2 },
}

export function LoadingView({ size = 32 }: { size?: number }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LoadingSpinner size={size} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    borderWidth: 2,
    borderRadius: 0,
    backgroundColor: "transparent",
  },
  edge: {
    position: "absolute",
    borderRadius: 0,
  },
})
