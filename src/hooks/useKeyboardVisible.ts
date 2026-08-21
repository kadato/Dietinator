import { useEffect, useState } from "react"
import { Keyboard, Platform } from "react-native"

/**
 * True while the software keyboard is open, but only on iOS. Floating action
 * buttons are hidden while it is true so they never sit behind the keyboard:
 *
 * - On iOS the keyboard overlaps the content, so hiding is required.
 * - On Android `adjustResize` lifts the content (and absolute FABs) above the
 *   keyboard automatically. Hiding is redundant, and a missed
 *   `keyboardDidHide` would leave the button gone for good.
 * - On web react-native-web's Keyboard is a stub and never fires events.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false)
  const enabled = Platform.OS === "ios"

  useEffect(() => {
    if (!enabled) return
    const showEvent = "keyboardWillShow"
    const hideEvent = "keyboardWillHide"
    const show = Keyboard.addListener(showEvent, () => setVisible(true))
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [enabled])

  return visible
}
