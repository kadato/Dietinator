import { Platform } from "react-native"

export type ColorPalette = {
  background: string
  surface: string
  surfaceAlt: string
  primary: string
  /** Deeper shade for text and icons on tinted primary backgrounds, such as tab rails. */
  primaryStrong: string
  primaryMuted: string
  onPrimary: string
  /** Secondary text on primary surfaces, headers and bubbles, clears 4.5 to 1 in both themes. */
  onPrimaryMuted: string
  /** Translucent chip/avatar surface laid on top of primary backgrounds. */
  primaryOverlay: string
  text: string
  textMuted: string
  /** Section titles and chrome on the page background, not on cards. */
  textOnBackground: string
  danger: string
  warning: string
  onWarning: string
  border: string
  breakfast: string
  lunch: string
  dinner: string
  snack: string
}

export const darkColors: ColorPalette = {
  background: "#1a1b26",
  surface: "#24283b",
  surfaceAlt: "#292e42",
  primary: "#7aa2f7",
  primaryStrong: "#7dcfff",
  primaryMuted: "#bb9af7",
  onPrimary: "#1a1b26",
  onPrimaryMuted: "#c0caf5",
  primaryOverlay: "rgba(122,162,247,0.14)",
  text: "#c0caf5",
  textMuted: "#a9b1d6",
  textOnBackground: "#c0caf5",
  danger: "#f7768e",
  warning: "#e0af68",
  onWarning: "#1a1b26",
  border: "#414868",
  // Vibrant, colorblind-safe macro and meal palette, Wong and Okabe-Ito.
  // Blue for protein and breakfast, amber for carbs and lunch, vermillion for fat and dinner
  // remain distinct under deuteranopia, protanopia, or tritanopia. Snack keeps
  // a teal that is luminance-separated from the three.
  breakfast: "#3A86FF",
  lunch: "#FFB020",
  dinner: "#FF4D6A",
  snack: "#2EC4B6",
}

export const lightColors: ColorPalette = {
  background: "#e1e2e7",
  surface: "#ffffff",
  surfaceAlt: "#d5d6db",
  primary: "#34548a",
  primaryStrong: "#0f4b6e",
  primaryMuted: "#5a3e8e",
  onPrimary: "#ffffff",
  onPrimaryMuted: "#d5d6db",
  primaryOverlay: "rgba(52,84,138,0.10)",
  text: "#343b58",
  textMuted: "#565a6e",
  textOnBackground: "#1a1b26",
  danger: "#8c4351",
  warning: "#8f5e15",
  onWarning: "#ffffff",
  border: "#a9b1d6",
  breakfast: "#0F5BA6",
  lunch: "#8A5A00",
  dinner: "#B91C3A",
  snack: "#137A6B",
}

export function getColors(scheme: string | null | undefined): ColorPalette {
  return scheme === "light" ? lightColors : darkColors
}

export const spacing = {
  "2xs": 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
}

/** Breakpoints and max widths for tablet / desktop / web layouts. */
export const layout = {
  breakpointMedium: 600,
  breakpointWide: 900,
  maxWidthNarrow: 420,
  maxWidthContent: 720,
  maxWidthWide: 1100,
  sideTabWidth: 120,
  /** Fixed bottom tab bar height on phones, excluding the safe-area inset. */
  tabBarHeight: 56,
}

/**
 * Terminal face: JetBrainsMono Nerd Font Mono with no ligatures.
 * Web: registered from assets/fonts by src/utils/web-fonts.ts.
 * Native: resolved verbatim from android/app/src/main/assets/fonts
 * as JetBrains Mono.ttf and JetBrains Mono_bold.ttf per RN font manager rules.
 */
const MONO_WEB = "'JetBrainsMono NFM', 'JetBrains Mono', monospace"
const MONO_NATIVE = "JetBrains Mono"

export const fonts = {
  mono: Platform.OS === "web" ? MONO_WEB : MONO_NATIVE,
  sans: Platform.OS === "web" ? MONO_WEB : MONO_NATIVE,
}
