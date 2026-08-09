import { useEffect, useState } from "react"
import { Keyboard, Platform } from "react-native"

/**
 * True while the software keyboard is open. Used to hide floating action
 * buttons so they never sit behind the keyboard on iOS, where modal content
 * is padded but absolutely-positioned elements stay screen-anchored.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"
    const show = Keyboard.addListener(showEvent, () => setVisible(true))
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  return visible
}
