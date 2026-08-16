export type ColorPalette = {
  background: string
  surface: string
  surfaceAlt: string
  primary: string
  /** Deeper shade for text/icons on tinted primary backgrounds (tab rails). */
  primaryStrong: string
  primaryMuted: string
  onPrimary: string
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
  primary: "#0d9488",
  primaryStrong: "#115e59",
  primaryMuted: "#14b8a6",
  onPrimary: "#ffffff",
  text: "#0f172a",
  textMuted: "#55606f",
  textOnBackground: "#111827",
  danger: "#dc2626",
  warning: "#d97706",
  onWarning: "#1a1a1a",
  border: "#d9dde3",
  breakfast: "#0d9488",
  lunch: "#ea580c",
  dinner: "#db2777",
  snack: "#ca8a04",
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
