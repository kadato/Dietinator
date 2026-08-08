export type ColorPalette = {
  background: string
  surface: string
  surfaceAlt: string
  primary: string
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
  background: "#141416",
  surface: "#1c1c1f",
  surfaceAlt: "#2a2a2f",
  primary: "#2dd4bf",
  primaryMuted: "#14b8a6",
  onPrimary: "#042f2e",
  text: "#fafafa",
  textMuted: "#a1a1aa",
  textOnBackground: "#fafafa",
  danger: "#f87171",
  warning: "#fbbf24",
  onWarning: "#1a1a1a",
  border: "#33333a",
  breakfast: "#2dd4bf",
  lunch: "#fb923c",
  dinner: "#f472b6",
  snack: "#facc15",
}

export const lightColors: ColorPalette = {
  background: "#f1f5f9",
  surface: "#ffffff",
  surfaceAlt: "#e2e8f0",
  primary: "#0d9488",
  primaryMuted: "#14b8a6",
  onPrimary: "#ffffff",
  text: "#0f172a",
  textMuted: "#64748b",
  textOnBackground: "#0f172a",
  danger: "#dc2626",
  warning: "#d97706",
  onWarning: "#1a1a1a",
  border: "#cbd5e1",
  breakfast: "#0d9488",
  lunch: "#ea580c",
  dinner: "#db2777",
  snack: "#ca8a04",
}

export function getColors(scheme: string | null | undefined): ColorPalette {
  return scheme === "light" ? lightColors : darkColors
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
}

/** Breakpoints and max widths for tablet / desktop / web layouts. */
export const layout = {
  breakpointMedium: 600,
  breakpointWide: 900,
  maxWidthNarrow: 420,
  maxWidthContent: 720,
  maxWidthWide: 1100,
  sideTabWidth: 120,
}
