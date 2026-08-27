import { Platform, StyleSheet, Text as RNText, TextInput as RNTextInput } from "react-native"
import { fonts } from "@/theme"

let patched = false

/**
 * Ensure Departure Mono shows everywhere on native, just like on web where
 * html,body { font-family: "Departure Mono" } makes every Text inherit.
 *
 * On native React Native, Text defaults to the system font (Roboto on Android,
 * San Francisco on iOS). Any Text without an explicit fontFamily therefore
 * renders in the system font on the installed app while the same screen looks
 * correct on web because react-native-web inherits from global.css.
 *
 * A second failure mode is weight: Departure Mono ships only a single Regular
 * outline. On Android, a style with fontFamily "Departure Mono" and
 * fontWeight "700" or "800" falls back to Roboto because no bold file exists.
 * Web avoids this by registering the same OTF under every weight via FontFace.
 * On native we coerce the weight to 400 so the single outline always wins.
 */
export function applyFontPatch() {
  if (Platform.OS === "web") return
  if (patched) return
  patched = true

  const originalFlatten = (
    StyleSheet as unknown as { flatten: (style: unknown) => Record<string, unknown> | undefined }
  ).flatten

  // Patch StyleSheet.flatten - the single funnel where RN merges style arrays
  // into a single object before painting. This catches every Text, TextInput
  // and any component that goes through StyleSheet, including NativeWind
  // generated styles (className="font-mono" etc) and gluestack Text.
  const ICON_FAMILIES = [
    "Ionicons",
    "Feather",
    "MaterialCommunityIcons",
    "MaterialIcons",
    "FontAwesome",
    "AntDesign",
    "Entypo",
    "EvilIcons",
    "Fontisto",
    "Foundation",
    "Octicons",
    "SimpleLineIcons",
    "Zocial",
    "Expo",
    "vector-icons",
  ] as const
  const isIconFamily = (s: string) => ICON_FAMILIES.some((f) => s.includes(f))
  ;(StyleSheet as unknown as { flatten: (style: unknown) => unknown }).flatten = ((
    style: unknown,
  ) => {
    const result = originalFlatten(style as never) as Record<string, unknown> | undefined
    if (!result || typeof result !== "object") return result as never

    const family = result.fontFamily
    const familyStr = Array.isArray(family) ? String((family as string[])[0]) : String(family ?? "")

    // Every text style without a family should be Departure Mono. Previous
    // version only patched when hasTextHint was true, leaving bare <Text>
    // (no fontSize/color) on the system font. Now patch unconditionally
    // unless it is an icon font which always carries an explicit family.
    if (result.fontFamily == null || result.fontFamily === "") {
      result.fontFamily = fonts.mono
    } else if (!isIconFamily(familyStr)) {
      const isDeparture =
        familyStr.includes("Departure Mono") ||
        familyStr.includes("DepartureMono") ||
        familyStr === fonts.mono
      // Force every non-icon family to Departure Mono. The app is mono
      // everywhere by design; "System", "Roboto", "sans-serif" etc all fall
      // back to the pixel face. This matches web where html,body sets the
      // family globally and every RN Text inherits.
      if (!isDeparture) {
        result.fontFamily = fonts.mono
      }
    }

    // Normalize Departure families: any requested weight must resolve to the
    // single Regular file we bundled. Coerce bold-ish weights to 400.
    const finalFamilyStr = Array.isArray(result.fontFamily)
      ? String((result.fontFamily as string[])[0])
      : String(result.fontFamily ?? "")
    const isDepartureFinal =
      finalFamilyStr.includes("Departure Mono") ||
      finalFamilyStr.includes("DepartureMono") ||
      finalFamilyStr === fonts.mono
    if (isDepartureFinal) {
      const rawWeight = result.fontWeight
      if (rawWeight != null) {
        const weightStr = String(rawWeight).toLowerCase()
        if (
          weightStr !== "400" &&
          weightStr !== "normal" &&
          weightStr !== "regular" &&
          weightStr !== "400.0"
        ) {
          result.fontWeight = "400"
        }
      }
      // Ensure family is the spaced canonical form that we registered
      result.fontFamily = fonts.mono
      // Also kill synthetic italic on a pixel face
      if (result.fontStyle === "italic") result.fontStyle = "normal"
    }

    return result as never
  }) as never

  // Also set defaultProps so bare <Text> without any style prop still gets mono
  // before flatten is even called. React 19 still honors defaultProps for RN Text.
  try {
    const TextAny = RNText as unknown as { defaultProps?: { style?: Record<string, unknown> } }
    if (!TextAny.defaultProps) TextAny.defaultProps = {}
    if (!TextAny.defaultProps.style) TextAny.defaultProps.style = {}
    if (!TextAny.defaultProps.style.fontFamily) {
      TextAny.defaultProps.style.fontFamily = fonts.mono
    }
    if (!TextAny.defaultProps.style.fontWeight) {
      // Keep default weight normal so we never trigger fallback
      TextAny.defaultProps.style.fontWeight = "400"
    }
  } catch {}

  try {
    const InputAny = RNTextInput as unknown as {
      defaultProps?: { style?: Record<string, unknown> }
    }
    if (!InputAny.defaultProps) InputAny.defaultProps = {}
    if (!InputAny.defaultProps.style) InputAny.defaultProps.style = {}
    if (!InputAny.defaultProps.style.fontFamily) {
      InputAny.defaultProps.style.fontFamily = fonts.mono
    }
  } catch {}
}
