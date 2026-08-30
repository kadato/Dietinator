import { Platform, StyleSheet, Text as RNText, TextInput as RNTextInput } from "react-native"
import { fonts } from "@/theme"

let patched = false

const ICON_PATTERNS = [
  "antdesign",
  "anticon",
  "entypo",
  "evilicons",
  "feather",
  "fontawesome",
  "fontcustom",
  "fontello",
  "fontisto",
  "foundation",
  "glyph",
  "icomoon",
  "icon",
  "ionicons",
  "material",
  "octicons",
  "simplelineicons",
  "symbols",
  "vector",
  "zocial",
] as const

export function isIconFamily(s: unknown): boolean {
  if (!s || typeof s !== "string") return false
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (!clean) return false
  return ICON_PATTERNS.some((pattern) => clean.includes(pattern))
}

/**
 * Ensure Departure Mono shows everywhere on native, matching web where
 * html,body sets font-family globally.
 *
 * Departure Mono ships ONLY a single Regular (400) outline.
 * On Android, React Native's font manager looks up typefaces based on weight.
 * If a style has fontWeight > 400 ("700", "bold", "600", "500", "800", etc.),
 * Android searches for a bold typeface variant, fails to find one, and
 * falls back to the default system font: Roboto Bold!
 *
 * We register React Native style attribute preprocessors to intercept
 * `fontWeight`, `fontFamily`, and `fontStyle` before styles reach native host
 * components, coercing font weights to "400" and ensuring Departure Mono
 * is used universally while preserving icon fonts.
 */
export function applyFontPatch() {
  if (Platform.OS === "web") return
  if (patched) return
  patched = true

  // 1. Register StyleSheet style attribute preprocessors (Fabric & Paper)
  try {
    const setPreprocessor = (
      StyleSheet as unknown as {
        setStyleAttributePreprocessor?: (prop: string, processor: (val: unknown) => unknown) => void
      }
    ).setStyleAttributePreprocessor

    if (typeof setPreprocessor === "function") {
      // Intercept fontWeight: coerce to "400" so Android never triggers Roboto fallback
      setPreprocessor("fontWeight", (val: unknown) => {
        if (val == null) return undefined
        return "400"
      })

      // Intercept fontFamily: ensure Departure Mono is used for all text except icon fonts
      setPreprocessor("fontFamily", (val: unknown) => {
        if (val == null || val === "") return fonts.mono
        const str = Array.isArray(val) ? String(val[0]) : String(val)
        if (isIconFamily(str)) return val
        return fonts.mono
      })

      // Intercept fontStyle: Departure Mono has no italic font
      setPreprocessor("fontStyle", (val: unknown) => {
        if (val == null) return undefined
        return "normal"
      })
    }
  } catch (err) {
    console.warn("[fonts] Failed to register style attribute preprocessors:", err)
  }

  // 2. Patch StyleSheet.flatten for any manual flatten calls
  const originalFlatten = (
    StyleSheet as unknown as { flatten: (style: unknown) => Record<string, unknown> | undefined }
  ).flatten

  ;(StyleSheet as unknown as { flatten: (style: unknown) => unknown }).flatten = ((
    style: unknown,
  ) => {
    const result = originalFlatten(style as never) as Record<string, unknown> | undefined
    if (!result || typeof result !== "object") return result as never

    const family = result.fontFamily
    const familyStr = Array.isArray(family) ? String((family as string[])[0]) : String(family ?? "")

    if (result.fontFamily == null || result.fontFamily === "") {
      result.fontFamily = fonts.mono
    } else if (!isIconFamily(familyStr)) {
      result.fontFamily = fonts.mono
    }

    const finalFamilyStr = Array.isArray(result.fontFamily)
      ? String((result.fontFamily as string[])[0])
      : String(result.fontFamily ?? "")
    if (!isIconFamily(finalFamilyStr)) {
      if (result.fontWeight != null) {
        result.fontWeight = "400"
      }
      if (result.fontStyle === "italic") {
        result.fontStyle = "normal"
      }
      result.fontFamily = fonts.mono
    }

    return result as never
  }) as never

  // 3. Set defaultProps on RNText and RNTextInput so bare text gets mono & 400 weight
  try {
    const TextAny = RNText as unknown as { defaultProps?: { style?: Record<string, unknown> } }
    if (!TextAny.defaultProps) TextAny.defaultProps = {}
    if (!TextAny.defaultProps.style) TextAny.defaultProps.style = {}
    TextAny.defaultProps.style.fontFamily = fonts.mono
    TextAny.defaultProps.style.fontWeight = "400"
  } catch {}

  try {
    const InputAny = RNTextInput as unknown as {
      defaultProps?: { style?: Record<string, unknown> }
    }
    if (!InputAny.defaultProps) InputAny.defaultProps = {}
    if (!InputAny.defaultProps.style) InputAny.defaultProps.style = {}
    InputAny.defaultProps.style.fontFamily = fonts.mono
    InputAny.defaultProps.style.fontWeight = "400"
  } catch {}
}
