export type ColorPalette = {
  background: string
  surface: string
  surfaceAlt: string
  primary: string
  /** Deeper shade for text/icons on tinted primary backgrounds (tab rails). */
  primaryStrong: string
  primaryMuted: string
  onPrimary: string
  /** Secondary text on primary surfaces (headers, bubbles) — clears 4.5:1 in both themes. */
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
  background: "#121215",
  surface: "#1a1a1e",
  surfaceAlt: "#26262c",
  primary: "#2dd4bf",
  primaryStrong: "#5eead4",
  primaryMuted: "#14b8a6",
  onPrimary: "#042f2e",
  onPrimaryMuted: "#0b4f49",
  primaryOverlay: "rgba(255, 255, 255, 0.18)",
  text: "#fafafa",
  textMuted: "#9d9da7",
  textOnBackground: "#f4f4f5",
  danger: "#f87171",
  warning: "#fbbf24",
  onWarning: "#1a1a1a",
  border: "#2c2c33",
  breakfast: "#2dd4bf",
  lunch: "#fb923c",
  dinner: "#f472b6",
  snack: "#facc15",
}

export const lightColors: ColorPalette = {
  background: "#f4f5f7",
  surface: "#ffffff",
  surfaceAlt: "#e8eaee",
  // teal-700 (#0f766e) fails as bold 11px text on the tinted budget badge
  // (4.05 on surfaceAlt) — teal-800 (#115e59) clears 4.5:1 there and on white
  // while keeping white button text at 7.7:1.
  primary: "#115e59",
  primaryStrong: "#0f766e",
  // teal-500 keeps the icon/avatar above 3:1 non-text contrast with white.
  primaryMuted: "#0d9488",
  onPrimary: "#ffffff",
  // Light teal text on the teal header/bubbles — 4.7:1 on primary (#115e59)
  // and 6+:1 on the darkened header chips.
  onPrimaryMuted: "#e0f1ef",
  // Darker than the dark theme's white overlay: white text/ON DEVICE chip on a
  // light teal header needs a darker chip to clear 4.5:1.
  primaryOverlay: "rgba(0, 0, 0, 0.16)",
  text: "#0f172a",
  textMuted: "#55606f",
  textOnBackground: "#111827",
  danger: "#dc2626",
  warning: "#d97706",
  onWarning: "#1a1a1a",
  border: "#d9dde3",
  // Meal accents at 700/800 level: bold 11-13px labels on white cards and on
  // their own ~13% tinted chips need ≥4.5:1, which the 700s barely miss on the
  // tints (3.6-4.3) — the 800s clear 5.5:1 everywhere.
  breakfast: "#115e59",
  lunch: "#9a3412",
  dinner: "#9d174d",
  snack: "#854d0e",
}

export function getColors(scheme: string | null | undefined): ColorPalette {
  return scheme === "light" ? lightColors : darkColors
}

export const spacing = {
  "2xs": 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 40,
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

export const fonts = {
  mono: "'JetBrains Mono', 'JetBrainsMono Nerd Font', 'Geist Mono', monospace",
  sans: "'Plus Jakarta Sans', 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}
