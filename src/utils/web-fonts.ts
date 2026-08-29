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
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const Asset = require("expo-asset").Asset
            await Asset.loadAsync(FONT_SOURCE)
          } catch {}
          // Register under both spaced and unspaced names - some Android
          // ROMs normalize the family, so both must resolve. Also register
          // weight-specific aliases pointing to the same Regular file: on
          // Android a Text with fontFamily "Departure Mono" and fontWeight
          // "700" would otherwise fall back to Roboto because no bold file
          // exists. By providing the same OTF under every weight key the
          // family resolves for any requested weight, and the pixel glyphs
          // stay crisp without faux-bold synthesis (handled on web via
          // FontFace weight descriptors).
          const weightAliases: Record<string, number> = {}
          const families = [FAMILY_DEPARTURE, "DepartureMono"] as const
          const weights = ["400", "500", "600", "700", "800"] as const
          const suffixes = [
            "",
            "-Regular",
            "_Regular",
            " Regular",
            "-400",
            "_400",
            " 400",
            "-500",
            "_500",
            " 500",
            "-600",
            "_600",
            " 600",
            "-700",
            "_700",
            " 700",
            "-800",
            "_800",
            " 800",
            "-Bold",
            "_Bold",
            " Bold",
            "-bold",
            "_bold",
            " bold",
            "-Medium",
            "_Medium",
            " Medium",
            "-SemiBold",
            "_SemiBold",
            " SemiBold",
            "-Normal",
            "_Normal",
            " Normal",
          ] as const
          for (const family of families) {
            weightAliases[family] = FONT_SOURCE as unknown as number
            // Explicit weight keys: e.g. "Departure Mono_700" - some RN
            // internals concatenate family + "_" + weight
            for (const w of weights) {
              weightAliases[`${family}_${w}`] = FONT_SOURCE as unknown as number
              weightAliases[`${family}-${w}`] = FONT_SOURCE as unknown as number
              weightAliases[`${family} ${w}`] = FONT_SOURCE as unknown as number
            }
            // Common style suffixes that Android font resolution may probe
            for (const sfx of suffixes) {
              if (!sfx) continue
              weightAliases[`${family}${sfx}`] = FONT_SOURCE as unknown as number
            }
            // String weight aliases like "Departure Mono_bold"
            weightAliases[`${family}_bold`] = FONT_SOURCE as unknown as number
            weightAliases[`${family}-bold`] = FONT_SOURCE as unknown as number
            weightAliases[`${family} bold`] = FONT_SOURCE as unknown as number
            weightAliases[`${family}_normal`] = FONT_SOURCE as unknown as number
            weightAliases[`${family}-normal`] = FONT_SOURCE as unknown as number
            weightAliases[`${family} normal`] = FONT_SOURCE as unknown as number
          }
          await Font.loadAsync(weightAliases)
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
