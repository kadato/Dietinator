import { useEffect, useState } from "react"
import { AccessibilityInfo } from "react-native"

/**
 * True when the OS Reduce Motion setting is on. Motion-producing components
 * (press scale, the stepping spinner) swap to static feedback when this is
 * true. Web already honors the media query in `global.css`; this hook covers
 * native.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled)
      })
      .catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion)
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [])

  return reduceMotion
}
