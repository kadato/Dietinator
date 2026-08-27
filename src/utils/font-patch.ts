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
  ;(StyleSheet as unknown as { flatten: (style: unknown) => unknown }).flatten = ((
    style: unknown,
  ) => {
    const result = originalFlatten(style as never) as Record<string, unknown> | undefined
    if (!result || typeof result !== "object") return result as never

    const hasTextHint =
      "fontSize" in result ||
      "fontWeight" in result ||
      "color" in result ||
      "letterSpacing" in result ||
      "lineHeight" in result ||
      "fontFamily" in result ||
      "textAlign" in result ||
      "textTransform" in result

    // If this looks like a text style and has no family, give it mono.
    // Avoid overriding icon fonts (Ionicons, Feather, MaterialCommunityIcons)
    // which always carry an explicit family.
    if (hasTextHint && (result.fontFamily == null || result.fontFamily === "")) {
      result.fontFamily = fonts.mono
    }

    // Normalize Departure families: any requested weight must resolve to the
    // single Regular file we bundled. Coerce bold-ish weights to 400.
    const family = result.fontFamily
    const familyStr = Array.isArray(family) ? String((family as string[])[0]) : String(family ?? "")
    const isDeparture =
      familyStr.includes("Departure Mono") ||
      familyStr.includes("DepartureMono") ||
      familyStr === fonts.mono
    if (isDeparture) {
      // Flatten may give numeric weight 700 etc; normalize both forms.
      const rawWeight = result.fontWeight
      if (rawWeight != null) {
        const weightStr = String(rawWeight)
        if (weightStr !== "400" && weightStr !== "normal" && weightStr !== "Regular") {
          result.fontWeight = "400"
        }
      }
      // Ensure family is the spaced canonical form that we registered
      result.fontFamily = fonts.mono
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
