import { useEffect } from "react"
import { Platform } from "react-native"

/**
 * Web/desktop affordance: close a modal with the Escape key. Native platforms
 * already close via system back (Android) or swipe (iOS), so the listener is
 * web-only. Attach at the modal component root alongside `visible`.
 */
export function useEscapeToClose(visible: boolean, onClose: () => void) {
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [visible, onClose])
}
