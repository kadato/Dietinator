/**
 * Single source of truth for the field-terminal visual world.
 *
 * Change the palette, spacing, borders or mono stack here and the whole
 * app follows - native via `useTheme()` / `getColors()` and web via
 * `global.css` CSS variables that mirror these values. Keep `DESIGN.md`,
 * `tailwind.config.js` meal tokens and `app/+html.tsx` shell in sync;
 * they are derived, not independent.
 *
 * To retune contrast, edit `lightColors` / `darkColors` only. Chip tints
 * use `tints.chip` (0.14) via `chipTint()` in `src/theme.helpers.ts`.
 * To change chrome weight, edit `borders.width` once.
 */
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
  onPrimaryMuted: "#24283b",
  primaryOverlay: "rgba(122,162,247,0.14)",
  text: "#c0caf5",
  textMuted: "#a9b1d6",
  textOnBackground: "#c0caf5",
  danger: "#ff7a8e",
  warning: "#e0af68",
  onWarning: "#1a1b26",
  border: "#6b739c",
  // Vibrant, colorblind-safe macro and meal palette, Wong and Okabe-Ito.
  // Blue for protein and breakfast, amber for carbs and lunch, vermillion for fat and dinner
  // remain distinct under deuteranopia, protanopia, or tritanopia. Snack keeps
  // a teal that is luminance-separated from the three.
  breakfast: "#6aa8ff",
  lunch: "#FFB020",
  dinner: "#ff7a92",
  snack: "#2EC4B6",
}

export const lightColors: ColorPalette = {
  background: "#f1f5f9",
  surface: "#ffffff",
  surfaceAlt: "#e2e8f0",
  primary: "#0066ff",
  primaryStrong: "#0044cc",
  primaryMuted: "#0f172a",
  onPrimary: "#ffffff",
  onPrimaryMuted: "#f1f5f9",
  primaryOverlay: "rgba(0,102,255,0.14)",
  text: "#0f172a",
  textMuted: "#475569",
  textOnBackground: "#0f172a",
  danger: "#e11d48",
  warning: "#d97706",
  onWarning: "#ffffff",
  border: "#0f172a",
  breakfast: "#0072b2",
  lunch: "#e69f00",
  dinner: "#d55e00",
  snack: "#009e73",
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

export const borders = {
  width: 1.5,
  widthThin: 1,
  radius: 0,
} as const

export const radii = {
  none: 0,
} as const

/**
 * Chip tint alpha - centralizes the 14% rule so contrast can be tuned once.
 * Update here and every meal pill, budget badge and icon well follows.
 */
export const tints = {
  chip: 0.14,
  chipStrong: 0.2,
  overlay: 0.14,
} as const

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
 * Terminal face: Chakra Petch with JetBrainsMono fallback.
 * Web: registered from assets/fonts by src/utils/web-fonts.ts.
 * Native: resolved verbatim from android/app/src/main/assets/fonts
 * as Chakra Petch per RN font manager rules.
 */
const CHAKRA_WEB = "'Chakra Petch', 'JetBrainsMono NFM', monospace"
const CHAKRA_NATIVE = "Chakra Petch"

export const fonts = {
  mono: Platform.OS === "web" ? CHAKRA_WEB : CHAKRA_NATIVE,
  sans: Platform.OS === "web" ? CHAKRA_WEB : CHAKRA_NATIVE,
  display: Platform.OS === "web" ? CHAKRA_WEB : CHAKRA_NATIVE,
}
