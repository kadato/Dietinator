/**
 * Modular theme entry. Re-exports palette, tokens, themes and helpers so
 * consumers can import from a single place or from granular modules.
 *
 *   import { getColors, spacing, cardStyle } from "@/theme"
 *   import type { ColorPalette } from "@/theme/palette"
 *   import { lightColors } from "@/theme/themes"
 *
 * For backward compatibility, `src/theme.ts` re-exports this barrel.
 */

export type { ColorPalette, MealType } from "./palette"

export { spacing, borders, radii, tints, overlays, layout, fonts, typography } from "./tokens"

export {
  darkColors,
  lightColors,
  themes,
  getColors,
  getTheme,
  getThemeOrFallback,
  registerCustomTheme,
  getCustomTheme,
  listThemes,
  listThemeOptions,
  type ThemeName,
  type BuiltinThemeName,
  type VscodeThemeName,
  type ThemePreference,
  type ThemeDefinition,
} from "./themes"

export {
  chipTint,
  cardStyle,
  borderStyle,
  iconBoxStyle,
  wellStyle,
  inputStyle,
  chipStyle,
  chipBorder,
  surfaceWellStyle,
  pressedStyle,
  barTrackStyle,
  barHighlight,
  flat,
} from "./helpers"

export {
  lightCssVars,
  darkCssVars,
  cssVarsForTheme,
  generateThemeCss,
  generateAllThemesCss,
} from "./css"

export { borderBase, cardBase, wellBase, thinBorder } from "./styles"

export { presets as textPresets, monoTabular, monoUppercase } from "./typography"

export { vscodePresets } from "./presets/vscode"
