import { useEffect, useState } from "react"
import { Keyboard, LayoutAnimation, Platform } from "react-native"

export interface KeyboardState {
  keyboardHeight: number
  isKeyboardVisible: boolean
}

/**
 * Hook to track software keyboard height and visibility across iOS, Android, and Web.
 * Smoothly animates on iOS and handles Android and Web visualViewport accurately.
 */
export function useKeyboardHeight(): KeyboardState {
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"

    const onShow = (e: { endCoordinates?: { height?: number } }) => {
      if (Platform.OS === "ios") {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      }
      setKeyboardHeight(e.endCoordinates?.height ?? 0)
    }
    const onHide = () => {
      if (Platform.OS === "ios") {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      }
      setKeyboardHeight(0)
    }

    const showSub = Keyboard.addListener(showEvent, onShow)
    const hideSub = Keyboard.addListener(hideEvent, onHide)

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !window.visualViewport) return
    const vv = window.visualViewport
    const update = () => {
      const offset = Math.max(0, Math.round(window.innerHeight - vv.height))
      setKeyboardHeight(offset > 50 ? offset : 0)
    }
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [])

  return { keyboardHeight, isKeyboardVisible: keyboardHeight > 0 }
}

export function useKeyboardVisible(): boolean {
  return useKeyboardHeight().isKeyboardVisible
}
