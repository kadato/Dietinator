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
  if (Platform.OS !== "web" || typeof navigator === "undefined" || typeof window === "undefined") {
    return
  }
  if (__DEV__) {
    // The dev server never registers a service worker, but a previous static
    // build on this origin may have left one behind. It serves the old
    // cached bundle and masks every code change. Unregister it and clear its
    // caches so dev always shows the current code.
    navigator.serviceWorker
      ?.getRegistrations?.()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      )
      .catch(() => undefined)
    if (typeof caches !== "undefined") {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .catch(() => undefined)
    }
    return
  }
  navigator.serviceWorker.register("/sw.js").catch(() => undefined)
}
