import { darkColors, lightColors, themes } from "./themes"
import type { ColorPalette } from "./palette"

/**
 * Single source for CSS variable generation. `global.css` and any future
 * theme stylesheet must mirror what this module exports. When adding a new
 * theme, add a branch here that maps its palette to CSS vars.
 *
 * Keeps `src/theme/themes.ts`, `global.css` and `tailwind.config.js` in sync.
 * Update the palette in `themes.ts` and the CSS output follows.
 */

export type CssVarMap = Record<string, string>

function varsForPalette(colors: ColorPalette, isDark: boolean): CssVarMap {
  return {
    "--app-background": colors.background,
    "--app-surface": colors.surface,
    "--app-surface-alt": colors.surfaceAlt,
    "--app-primary": colors.primary,
    "--app-border": colors.border,
    "--app-text": colors.text,
    "--app-text-muted": colors.textMuted,
    "--app-danger": colors.danger,
    "--app-warning": colors.warning,
    "--app-on-primary": colors.onPrimary,
    "--meal-b": colors.breakfast,
    "--meal-l": colors.lunch,
    "--meal-d": colors.dinner,
    "--meal-s": colors.snack,
    "--app-water": colors.water ?? colors.primary,
    "--app-weight": colors.weight ?? colors.primary,
    "--app-success": colors.success ?? colors.primary,
    "--bg-grid": isDark ? "rgba(192, 202, 245, 0.035)" : "rgba(15, 23, 42, 0.035)",
    "--paper-grid": isDark ? "rgba(192, 202, 245, 0.035)" : "rgba(15, 23, 42, 0.035)",
    "--scrim": "rgba(26, 27, 38, 0.65)",
    "--bg": colors.background,
    "--surface": colors.surface,
    "--surface-alt": colors.surfaceAlt,
    "--ink": colors.text,
    "--ink-muted": colors.textMuted,
    "--primary": colors.primary,
    "--on-primary": colors.onPrimary,
    "--border": colors.border,
  }
}

export function lightCssVars(): CssVarMap {
  return varsForPalette(lightColors, false)
}

export function darkCssVars(): CssVarMap {
  return varsForPalette(darkColors, true)
}

export function cssVarsForTheme(name: string): CssVarMap | null {
  const t = (themes as Record<string, { colors: ColorPalette; isDark: boolean }>)[name]
  if (!t) return null
  return varsForPalette(t.colors, t.isDark)
}

/**
 * Render a map as CSS declarations. Handy for docs or a build step that
 * regenerates `global.css`.
 */
export function cssVarsToString(vars: CssVarMap, indent = "  "): string {
  return Object.entries(vars)
    .map(([k, v]) => `${indent}${k}: ${v};`)
    .join("\n")
}

export function generateThemeCss(): string {
  return `:root {\n${cssVarsToString(lightCssVars())}\n}\n\nhtml.dark {\n${cssVarsToString(darkCssVars())}\n}\n`
}

export function generateAllThemesCss(): string {
  const blocks: string[] = []
  blocks.push(`:root {\n${cssVarsToString(lightCssVars())}\n}`)
  blocks.push(`html.dark {\n${cssVarsToString(darkCssVars())}\n}`)
  for (const [name, def] of Object.entries(themes)) {
    if (name === "light" || name === "dark") continue
    const vars = varsForPalette(def.colors, def.isDark)
    blocks.push(`html.theme-${name} {\n${cssVarsToString(vars)}\n}`)
  }
  return blocks.join("\n\n")
}
