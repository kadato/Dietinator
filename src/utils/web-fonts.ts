import { useEffect, useState } from "react"
import { Platform } from "react-native"

/**
 * Bundled terminal face: Departure Mono, a single-weight pixel monospace.
 * It ships one Regular outline, so every weight descriptor maps to that one
 * file. This stops the browser from synthesizing faux bold, which smears
 * pixel glyphs.
 *
 * Web registers each weight through the CSS Font Loading API with its exact
 * file; Metro serves the binary in dev and bundles it into dist/ on export.
 * Native resolves the family from android/app/src/main/assets/fonts instead,
 * so this hook is a no-op there.
 *
 * No bundled fallback: glyphs Departure Mono does not cover fall through the
 * CSS stack to the system monospace.
 */
const FAMILY_DEPARTURE = "Departure Mono"

const FONT_FILES = (["400", "500", "600", "700", "800"] as const).map((weight) => ({
  family: FAMILY_DEPARTURE,
  weight,
  src: require("../../assets/fonts/DepartureMono-Regular.otf"),
}))

/**
 * True once the faces are registered for this web session. Module scope on
 * purpose: document.fonts.check() cannot guard here because it returns true
 * for unknown families (the matcher falls through to the default font), so a
 * check-based guard would skip loading forever. Fast refresh re-mounts the
 * component but keeps module state, so this flag deduplicates registration.
 */
let registered = false

/** Starts the font load once per web session; returns when faces are ready. */
export function useBundledTerminalFont(): boolean {
  const [loaded, setLoaded] = useState(() => Platform.OS !== "web" || registered)

  useEffect(() => {
    if (Platform.OS !== "web" || registered) return
    registered = true
    let cancelled = false
    Promise.all(
      FONT_FILES.map(async ({ family, weight, src }) => {
        const face = new FontFace(family, `url(${String(src)})`, {
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
