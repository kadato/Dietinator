import { Alert, Platform } from "react-native"

type ConfirmOptions = {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel?: () => void
}

/**
 * Cross-platform confirmation.
 * React Native Web's `Alert.alert` is a no-op, so on web we fall back to
 * `window.confirm` — without this, destructive actions were silently
 * impossible in the browser.
 */
export function confirmAction({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmOptions): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${message}\n\n${confirmLabel}`)) {
      onConfirm()
    } else {
      onCancel?.()
    }
    return
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel", onPress: onCancel },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ])
}
