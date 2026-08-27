import { useEffect, useState } from "react"
import { Platform } from "react-native"
import * as Font from "expo-font"

/**
 * Bundled terminal face: Departure Mono, a single-weight pixel monospace.
 * It ships one Regular outline, so every weight descriptor maps to that one
 * file. This stops the browser from synthesizing faux bold, which smears
 * pixel glyphs.
 *
 * Web registers each weight through the CSS Font Loading API with its exact
 * file; Metro serves the binary in dev and bundles it into dist/ on export.
 * Native loads the file via expo-font so the family resolves on Android
 * and iOS without needing android/app/src/main/assets/fonts.
 */
const FAMILY_DEPARTURE = "Departure Mono"

const FONT_SOURCE = require("../../assets/fonts/DepartureMono-Regular.otf")

const FONT_FILES = (["400", "500", "600", "700", "800"] as const).map((weight) => ({
  family: FAMILY_DEPARTURE,
  weight,
  src: FONT_SOURCE,
}))

let registered = false
let nativeLoaded = false

/** Starts the font load once per session; returns when faces are ready. */
export function useBundledTerminalFont(): boolean {
  const [loaded, setLoaded] = useState(() => {
    if (Platform.OS === "web") return registered
    return nativeLoaded
  })

  useEffect(() => {
    if (Platform.OS === "web") {
      if (registered) return
      registered = true
      let cancelled = false
      // Resolve the asset URI correctly on web. Metro's require can return
      // a numeric ID or an object, so use expo-asset to get the real URL.
      let assetUri: string
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Asset = require("expo-asset").Asset
        assetUri = Asset.fromModule(FONT_SOURCE).uri
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
    } else {
      if (nativeLoaded) return
      let cancelled = false
      const fallback = setTimeout(() => {
        if (!cancelled) {
          console.warn("[fonts] Departure Mono load timed out after 5s, showing fallback")
          setLoaded(true)
        }
      }, 5000)
      ;(async () => {
        try {
          // Ensure the asset is downloaded first (important on first install).
          try {
            const Asset = require("expo-asset").Asset
            await Asset.loadAsync(FONT_SOURCE)
          } catch {}
          // Register under both spaced and unspaced names - some Android
          // ROMs normalize the family, so both must resolve.
          await Font.loadAsync({
            [FAMILY_DEPARTURE]: FONT_SOURCE,
            DepartureMono: FONT_SOURCE,
          })
          nativeLoaded = true
          console.log("[fonts] Departure Mono loaded")
          if (!cancelled) setLoaded(true)
        } catch (error) {
          console.warn("[fonts] Departure Mono failed to load", String(error))
          if (!cancelled) setLoaded(true)
        } finally {
          clearTimeout(fallback)
        }
      })()
      return () => {
        cancelled = true
        clearTimeout(fallback)
      }
    }
  }, [])

  return loaded
}
