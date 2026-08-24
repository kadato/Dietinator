import { useEffect, useState } from "react"
import { Platform } from "react-native"

/**
 * Bundled terminal face: JetBrainsMono Nerd Font Mono. The NFM build ships
 * without ligatures (Nerd Fonts policy for the Mono suffix), which the field
 * terminal requires so ledger columns never fuse.
 *
 * Web registers each weight through the CSS Font Loading API with its exact
 * file; Metro serves the binaries in dev and bundles them into dist/ on
 * export. Native resolves the family from android/app/src/main/assets/fonts
 * instead, so this hook is a no-op there.
 */
const FAMILY_CHAKRA = "Chakra Petch"
const FAMILY_MONO = "JetBrainsMono NFM"

const FONT_FILES = [
  // Chakra Petch weights
  {
    family: FAMILY_CHAKRA,
    weight: "400",
    src: require("../../assets/fonts/ChakraPetch-Regular.ttf"),
  },
  {
    family: FAMILY_CHAKRA,
    weight: "500",
    src: require("../../assets/fonts/ChakraPetch-Medium.ttf"),
  },
  {
    family: FAMILY_CHAKRA,
    weight: "600",
    src: require("../../assets/fonts/ChakraPetch-SemiBold.ttf"),
  },
  { family: FAMILY_CHAKRA, weight: "700", src: require("../../assets/fonts/ChakraPetch-Bold.ttf") },
  // JetBrainsMono weights (fallback)
  {
    family: FAMILY_MONO,
    weight: "400",
    src: require("../../assets/fonts/JetBrainsMonoNFM-Regular.ttf"),
  },
  {
    family: FAMILY_MONO,
    weight: "500",
    src: require("../../assets/fonts/JetBrainsMonoNFM-Medium.ttf"),
  },
  {
    family: FAMILY_MONO,
    weight: "600",
    src: require("../../assets/fonts/JetBrainsMonoNFM-SemiBold.ttf"),
  },
  {
    family: FAMILY_MONO,
    weight: "700",
    src: require("../../assets/fonts/JetBrainsMonoNFM-Bold.ttf"),
  },
  {
    family: FAMILY_MONO,
    weight: "800",
    src: require("../../assets/fonts/JetBrainsMonoNFM-ExtraBold.ttf"),
  },
]

/** Starts the font load once per web session; returns when faces are ready. */
export function useBundledTerminalFont(): boolean {
  const [loaded, setLoaded] = useState(() => {
    if (Platform.OS !== "web") return true
    // Fast refresh can re-mount after faces are already registered.
    return (
      typeof document !== "undefined" && Boolean(document.fonts?.check(`16px "${FAMILY_CHAKRA}"`))
    )
  })

  useEffect(() => {
    if (Platform.OS !== "web" || loaded) return
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
  }, [loaded])

  return loaded
}
