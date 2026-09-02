import type { ColorPalette } from "./palette"
import { vscodePresets } from "./presets/vscode"

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
  // Blue for protein and breakfast, amber for carbs and lunch, vermillion for
  // fat and dinner remain distinct under deuteranopia, protanopia, or
  // tritanopia. Snack keeps a teal that is luminance-separated from the three.
  // Breakfast and dinner are lifted past the Okabe-Ito originals until they
  // clear 4.5 to 1 as text on their own tinted chip wells.
  breakfast: "#8db8ff",
  lunch: "#FFB020",
  dinner: "#ff92a6",
  snack: "#2EC4B6",
}

export const lightColors: ColorPalette = {
  background: "#f1f5f9",
  surface: "#ffffff",
  surfaceAlt: "#e2e8f0",
  primary: "#0b57d0",
  primaryStrong: "#0044cc",
  primaryMuted: "#0f172a",
  onPrimary: "#ffffff",
  onPrimaryMuted: "#f1f5f9",
  primaryOverlay: "rgba(11,87,208,0.14)",
  text: "#0f172a",
  textMuted: "#475569",
  textOnBackground: "#0f172a",
  danger: "#be123c",
  warning: "#96610a",
  onWarning: "#ffffff",
  border: "#0f172a",
  // Vibrant, colorblind-safe macro and meal palette, Wong and Okabe-Ito
  // darkened until every value clears 4.5 to 1 as text on white, the page
  // background, and its own tinted chip well. Blue for protein and breakfast,
  // amber for carbs and lunch, vermillion for fat and dinner remain distinct
  // under deuteranopia, protanopia, or tritanopia. Snack keeps a teal that is
  // luminance-separated from the three.
  breakfast: "#075985",
  lunch: "#804707",
  dinner: "#96340a",
  snack: "#0b5f5a",
}

export type BuiltinThemeName = "light" | "dark"
export type VscodeThemeName = (typeof vscodePresets)[number]["id"]
export type ThemeName = BuiltinThemeName | VscodeThemeName
export type ThemePreference = ThemeName | "system"

export type ThemeDefinition = {
  name: ThemeName
  label: string
  colors: ColorPalette
  isDark: boolean
  group: string
}

/**
 * Registry of built-in themes. To add a theme:
 * 1. Define its ColorPalette in `src/theme/presets/vscode.ts` or here.
 * 2. Add an entry here and to `src/theme/css.ts` + `global.css` (`html.theme-<name>`).
 * 3. The name automatically becomes selectable in Settings via `listThemes()`.
 *
 * VSCode-popular themes are preseeded so the field terminal can match the editor.
 */
const builtinThemes: Record<BuiltinThemeName, ThemeDefinition> = {
  light: {
    name: "light",
    label: "Dietinator Light",
    colors: lightColors,
    isDark: false,
    group: "Dietinator",
  },
  dark: {
    name: "dark",
    label: "Dietinator Dark",
    colors: darkColors,
    isDark: true,
    group: "Dietinator",
  },
}

const vscodeThemeMap = Object.fromEntries(
  vscodePresets.map(
    (p) =>
      [
        p.id,
        {
          name: p.id,
          label: p.label,
          colors: p.palette,
          isDark: p.isDark,
          group: p.group,
        } as ThemeDefinition,
      ] as const,
  ),
) as Record<VscodeThemeName, ThemeDefinition>

export const themes: Record<ThemeName, ThemeDefinition> = {
  ...builtinThemes,
  ...vscodeThemeMap,
} as Record<ThemeName, ThemeDefinition>

export function getColors(scheme: string | null | undefined): ColorPalette {
  return scheme === "light" ? lightColors : darkColors
}

export function getTheme(name: string): ThemeDefinition | undefined {
  return (themes as Record<string, ThemeDefinition>)[name] ?? customThemes.get(name)
}

export function getThemeOrFallback(name: string): ThemeDefinition {
  return getTheme(name) ?? themes.dark
}

/**
 * Extensible registry for runtime custom themes beyond the preseeded ones.
 * Call this at startup to add a custom theme without editing themes.ts.
 *
 * Example:
 *   registerCustomTheme("sepia", { ...lightColors, background: "#fdf6e3", surface: "#eee8d5" })
 */
const customThemes = new Map<string, ThemeDefinition>()

export function registerCustomTheme(
  name: string,
  colors: ColorPalette,
  opts?: { isDark?: boolean; label?: string; group?: string },
): void {
  customThemes.set(name, {
    name: name as ThemeName,
    label: opts?.label ?? name,
    colors,
    isDark: opts?.isDark ?? false,
    group: opts?.group ?? "Custom",
  })
}

export function getCustomTheme(name: string): ThemeDefinition | undefined {
  return customThemes.get(name)
}

export function listThemes(): ThemeDefinition[] {
  return [...Object.values(themes), ...customThemes.values()]
}

export function listThemeOptions(): {
  value: ThemePreference
  label: string
  group: string
  isDark: boolean
}[] {
  return [
    { value: "system", label: "System", group: "System", isDark: false },
    ...listThemes().map((t) => ({
      value: t.name as ThemePreference,
      label: t.label,
      group: t.group,
      isDark: t.isDark,
    })),
  ]
}
