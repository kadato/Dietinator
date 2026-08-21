import { useCallback, useState } from "react"

/**
 * Tracks whether a Pressable is currently pressed so feedback styles can be
 * applied statically. React Native 0.85 Fabric drops Pressable style
 * functions on Android, collapsing unstyled views to their content size.
 * Keep press feedback in state-driven static styles instead.
 */
export function usePressedState() {
  const [pressed, setPressed] = useState(false)
  const onPressIn = useCallback(() => setPressed(true), [])
  const onPressOut = useCallback(() => setPressed(false), [])
  return { pressed, onPressIn, onPressOut }
}
