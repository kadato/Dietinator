import { useEffect, useState } from "react"

/**
 * Web implementation of the bundled Departure Mono loader. Metro resolves
 * this file instead of `web-fonts.ts` for web bundles only.
 *
 * Web registers each weight through the CSS Font Loading API. The WOFF2
 * file downloads faster than the OTF; the OTF stays as fallback. The WOFF2
 * require lives here and nowhere else: if it ever enters a native bundle,
 * Gradle fails the release build with "Duplicate resources" because both
 * files map to one Android resource name. See `web-fonts.ts`.
 */
const FAMILY_DEPARTURE = "Departure Mono"

const FONT_SOURCE = require("../../assets/fonts/DepartureMono-Regular.otf")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FONT_SOURCE_WOFF2 = require("../../assets/fonts/DepartureMono-Regular.woff2")

const FONT_FILES = (["400", "500", "600", "700", "800"] as const).map((weight) => ({
  family: FAMILY_DEPARTURE,
  weight,
  src: FONT_SOURCE,
}))

let registered = false

/** Starts the font load once per session; returns when faces are ready. */
export function useBundledTerminalFont(): boolean {
  const [loaded, setLoaded] = useState(() => registered)

  useEffect(() => {
    if (registered) return
    registered = true
    let cancelled = false
    // Resolve the asset URI correctly on web. Metro's require can return
    // a numeric ID or an object, so use expo-asset to get the real URL.
    let assetUri: string
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Asset = require("expo-asset").Asset
      const woff2Uri = Asset.fromModule(FONT_SOURCE_WOFF2).uri as string | null
      assetUri = woff2Uri ?? (Asset.fromModule(FONT_SOURCE).uri as string)
    } catch {
      assetUri = String(FONT_SOURCE)
    }
    Promise.all(
      FONT_FILES.map(async ({ family, weight }) => {
        const face = new FontFace(family, `url(${assetUri})`, {
          weight,
          display: "swap",
        })
        await face.load()
        document.fonts.add(face)
      }),
    )
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return loaded
}
