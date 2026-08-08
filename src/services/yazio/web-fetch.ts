import { Platform } from "react-native"

/** Official API base baked into the `yazio` npm package. */
export const YAZIO_API_BASE = "https://yzapi.yazio.com/v15"

/** Same-origin prefix handled by Metro dev middleware (see metro.config.js). */
export const YAZIO_WEB_PROXY_PREFIX = "/api/yazio"

declare global {
  // eslint-disable-next-line no-var
  var __dietinatorYazioWebFetchInstalled: boolean | undefined
}

function toProxiedUrl(url: string): string {
  if (!url.startsWith(YAZIO_API_BASE)) return url
  return `${YAZIO_WEB_PROXY_PREFIX}${url.slice(YAZIO_API_BASE.length)}`
}

/**
 * On web, route YAZIO `fetch` calls through the Metro dev server proxy so the
 * browser never talks to yzapi.yazio.com directly (CORS blocks that origin).
 */
export function installYazioWebFetch(): void {
  if (Platform.OS !== "web") return
  if (globalThis.__dietinatorYazioWebFetchInstalled) return

  const nativeFetch = globalThis.fetch.bind(globalThis)

  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (typeof input === "string") {
      return nativeFetch(toProxiedUrl(input), init)
    }
    if (input instanceof URL) {
      const href = input.href
      if (href.startsWith(YAZIO_API_BASE)) {
        return nativeFetch(toProxiedUrl(href), init)
      }
      return nativeFetch(input, init)
    }
    if (input instanceof Request && input.url.startsWith(YAZIO_API_BASE)) {
      return nativeFetch(new Request(toProxiedUrl(input.url), input), init)
    }
    return nativeFetch(input, init)
  }

  globalThis.__dietinatorYazioWebFetchInstalled = true
}
