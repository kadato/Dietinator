/**
 * Example custom theme. Copy this file to add a real theme.
 *
 * Steps:
 * 1. Uncomment and import lightColors, then tweak to your palette.
 * 2. Register it at startup: `registerCustomTheme("sepia", sepiaColors)`
 * 3. Add CSS vars in `src/theme/css.ts` and `global.css` under `html.theme-sepia`.
 * 4. Add "sepia" to `ThemeName` / `ThemePreference` if it should appear in Settings.
 *
 * This file is not imported by default so it adds no bundle cost.
 */

import type { ColorPalette } from "../palette"
import { lightColors } from "../themes"

// Uncomment to create a sepia paper theme derived from light.
export const sepiaColors: ColorPalette = {
  ...lightColors,
  background: "#fdf6e3",
  surface: "#eee8d5",
  surfaceAlt: "#d9ccab",
  primary: "#b58900",
  primaryStrong: "#cb4b16",
  primaryMuted: "#657b83",
  text: "#586e75",
  textMuted: "#657b83",
  border: "#586e75",
  // Keep meal colors from light for AAA contrast, or adjust if needed.
}

// Usage:
// import { registerCustomTheme } from "@/theme"
// import { sepiaColors } from "@/theme/examples/sepia.example"
// registerCustomTheme("sepia", sepiaColors, { isDark: false })
//
// Then in global.css:
// html.theme-sepia { --app-background: #fdf6e3; --app-surface: #eee8d5; ... }
