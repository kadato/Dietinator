import { useEffect, useMemo } from "react"
import { radii } from "@/theme"
import { Animated, Easing, Platform, StyleSheet, View } from "react-native"
import { useReduceMotion } from "@/hooks/useReduceMotion"
import { useTheme } from "@/hooks/useTheme"

/** One revolution every 900ms, smooth. */
export const SPINNER_STEP_MS = 160

/**
 * Single thick progress arc that sweeps the square perimeter. The previous
 * two-line well (track + stepping edge) read as two separate strokes; now
 * one 270° arc (`borderTopColor transparent`) rotates continuously, leaving
 * a clear gap for progress.
 */
export function LoadingSpinner({ size = 32 }: { size?: number }) {
  const { colors } = useTheme()
  const reduceMotion = useReduceMotion()
  const spin = useMemo(() => new Animated.Value(0), [])

  useEffect(() => {
    if (reduceMotion) return
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [reduceMotion, spin])

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  })

  const thickness = Math.max(Math.round(size * 0.12), 4)

  if (reduceMotion) {
    return (
      <View
        style={[
          styles.trackStatic,
          {
            width: size,
            height: size,
            borderWidth: thickness,
            borderColor: colors.primary,
            backgroundColor: "transparent",
          },
        ]}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading"
      />
    )
  }

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      <Animated.View
        style={[
          styles.arc,
          {
            width: size,
            height: size,
            borderWidth: thickness,
            borderColor: colors.primary,
            borderTopColor: "transparent",
            transform: [{ rotate }],
          },
        ]}
      />
    </View>
  )
}

export function LoadingView({ size = 32 }: { size?: number }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
      <LoadingSpinner size={size} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  trackStatic: {
    borderRadius: radii.none,
    backgroundColor: "transparent",
  },
  arc: {
    borderRadius: radii.none,
    backgroundColor: "transparent",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
})
