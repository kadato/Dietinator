import { Platform } from "react-native"

export type ColorPalette = {
  background: string
  surface: string
  surfaceAlt: string
  primary: string
  /** Deeper shade for text/icons on tinted primary backgrounds (tab rails). */
  primaryStrong: string
  primaryMuted: string
  onPrimary: string
  /** Secondary text on primary surfaces (headers, bubbles), clears 4.5:1 in both themes. */
  onPrimaryMuted: string
  /** Translucent chip/avatar surface laid on top of primary backgrounds. */
  primaryOverlay: string
  text: string
  textMuted: string
  /** Section titles and chrome on the page background (not on cards). */
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
  breakfast: "#8ab4f8",
  lunch: "#bb9af7",
  dinner: "#f7768e",
  snack: "#e0af68",
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
  breakfast: "#214a7a",
  lunch: "#5a3e8e",
  dinner: "#8c4351",
  snack: "#8f5e15",
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
  /** Fixed bottom tab bar height on phones (excluding the safe-area inset). */
  tabBarHeight: 64,
}

/**
 * Terminal face: JetBrainsMono Nerd Font Mono (no ligatures).
 * Web: registered from assets/fonts by src/utils/web-fonts.ts.
 * Native: resolved verbatim from android/app/src/main/assets/fonts
 * (JetBrains Mono.ttf + JetBrains Mono_bold.ttf per RN font manager rules).
 */
const MONO_WEB = "'JetBrainsMono NFM', 'JetBrains Mono', monospace"
const MONO_NATIVE = "JetBrains Mono"

export const fonts = {
  mono: Platform.OS === "web" ? MONO_WEB : MONO_NATIVE,
  sans: Platform.OS === "web" ? MONO_WEB : MONO_NATIVE,
}
