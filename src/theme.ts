/**
 * Single source of truth for the field-terminal visual world.
 *
 * This file is now a compatibility shim. The modular definitions live in
 * `src/theme/*` so future themes can be added without editing a monolith:
 *
 *   src/theme/palette.ts  - ColorPalette type
 *   src/theme/tokens.ts   - spacing, borders, radii, tints, layout, fonts
 *   src/theme/themes.ts   - light/dark palettes, registry, getColors
 *   src/theme/helpers.ts  - chipTint, cardStyle and other shared helpers
 *   src/theme/css.ts      - CSS variable generation for global.css
 *   src/theme/typography.ts - mono presets
 *   src/theme/styles.ts   - flat/card/well primitives
 *   src/theme/index.ts    - barrel re-export
 *
 * Change the palette, spacing, borders or mono stack via those modules and
 * the whole app follows - native via `useTheme()` / `getColors()` and web via
 * `global.css` CSS variables that mirror these values. Keep `DESIGN.md`,
 * `tailwind.config.js` meal tokens and `app/+html.tsx` shell in sync;
 * they are derived, not independent. For a new theme, see `src/theme/themes.ts`
 * and `src/theme/css.ts`.
 *
 * To retune contrast, edit `lightColors` / `darkColors` only. Chip tints
 * use `tints.chip` (0.14) via `chipTint()` in `src/theme/helpers.ts`.
 * To change chrome weight, edit `borders.width` once.
 */

export type { ColorPalette, MealType } from "./theme/palette"
export {
  darkColors,
  lightColors,
  getColors,
  themes,
  getTheme,
  getThemeOrFallback,
  registerCustomTheme,
  getCustomTheme,
  listThemes,
  listThemeOptions,
} from "./theme/themes"
export type {
  ThemeName,
  BuiltinThemeName,
  VscodeThemeName,
  ThemePreference,
  ThemeDefinition,
} from "./theme/themes"
export { spacing, borders, radii, tints, overlays, layout, fonts, typography } from "./theme/tokens"
export {
  lightCssVars,
  darkCssVars,
  cssVarsForTheme,
  generateThemeCss,
  generateAllThemesCss,
} from "./theme/css"
export { vscodePresets } from "./theme/presets/vscode"
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
} from "./theme/helpers"
export { presets as textPresets, monoTabular, monoUppercase } from "./theme/typography"
export { borderBase, cardBase, wellBase, thinBorder } from "./theme/styles"
