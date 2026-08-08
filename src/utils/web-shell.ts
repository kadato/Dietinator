import { Platform } from "react-native"

/** Hide the inlined pre-JS loading shell once React has painted (web only). */
export function hideWebShell(): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return
  document.documentElement.dataset.shellHide = "true"
}

/**
 * Register the production service worker on web for offline support and
 * instant repeat loads. Skipped in development and on native.
 * Registering immediately (not on `load`) guarantees a registration attempt
 * in every session; the browser performs the work asynchronously.
 */
export function registerWebServiceWorker(): void {
  if (Platform.OS !== "web" || __DEV__) return
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    typeof window === "undefined"
  ) {
    return
  }
  navigator.serviceWorker.register("/sw.js").catch(() => undefined)
}
