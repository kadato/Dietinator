import React, { createContext, useEffect, useMemo } from "react"
import { Platform, useColorScheme } from "react-native"
import { getColors, getTheme, getCustomTheme, type ColorPalette } from "@/theme"
import type { ThemeName } from "@/theme/themes"
import { useApp } from "./AppContext"
import { cssVarsForTheme } from "@/theme/css"

export type AppColorScheme = ThemeName
export type ResolvedTheme = ThemeName

type ThemeContextValue = {
  colors: ColorPalette
  colorScheme: ResolvedTheme
  isDark: boolean
  themeName: ThemeName | "system"
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Resolves the effective color scheme from the user's explicit theme
 * preference (Settings) falling back to the OS scheme. Must be mounted
 * inside AppProvider; wrap the UI (incl. GluestackUIProvider) in it.
 *
 * Extensibility: to add a new theme, define its palette in `src/theme/presets/vscode.ts`,
 * add CSS vars in `src/theme/css.ts` + `global.css` (`html.theme-<name>`).
 * The picker in Settings reads `listThemes()` so it appears automatically.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useApp()
  const systemScheme = useColorScheme()
  const preference = settings.theme_preference ?? "system"

  // Resolve "system" to the OS preference, otherwise use the explicit choice.
  const rawScheme: string =
    preference === "system" ? (systemScheme === "light" ? "light" : "dark") : preference

  const builtin = getTheme(rawScheme)
  const custom = !builtin ? getCustomTheme(rawScheme) : undefined
  const themeDef = builtin ?? custom

  const colorScheme: ResolvedTheme = (
    themeDef ? (themeDef.name as ResolvedTheme) : rawScheme === "light" ? "light" : "dark"
  ) as ResolvedTheme
  const isDark = themeDef ? themeDef.isDark : colorScheme === "dark"
  const colors = themeDef ? themeDef.colors : getColors(colorScheme)

  const value = useMemo(
    () => ({
      colors,
      colorScheme,
      isDark,
      themeName: (themeDef?.name ?? colorScheme) as ThemeName,
    }),
    [colors, colorScheme, isDark, themeDef],
  )

  // Web: keep the document element in sync so `global.css` vars and the
  // inlined shell script stay coherent. Native gets colors via context only.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return
    const el = document.documentElement
    // Remove any previous theme-* class and the dark/light helpers
    const toRemove: string[] = []
    el.classList.forEach((c) => {
      if (c.startsWith("theme-") || c === "dark" || c === "light") toRemove.push(c)
    })
    toRemove.forEach((c) => el.classList.remove(c))

    if (themeDef && themeDef.name !== "light" && themeDef.name !== "dark") {
      el.classList.add(`theme-${themeDef.name}`)
      el.style.colorScheme = themeDef.isDark ? "dark" : "light"
      // Also keep `dark` for selectors that still rely on it (gluestack, etc.)
      if (themeDef.isDark) el.classList.add("dark")
    } else {
      // Builtin light/dark: mirror the old `dark` class contract
      if (isDark) {
        el.classList.add("dark")
        el.style.colorScheme = "dark"
      } else {
        el.classList.remove("dark")
        el.style.colorScheme = "light"
      }
    }

    // For custom themes that are not yet in `global.css`, push vars inline as fallback
    if (themeDef && !["light", "dark"].includes(themeDef.name)) {
      const vars = cssVarsForTheme(themeDef.name)
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v))
      }
    } else {
      // Clear any inline overrides when returning to builtin themes
      const vars = [
        "--app-background",
        "--app-surface",
        "--app-surface-alt",
        "--app-primary",
        "--app-border",
        "--app-text",
        "--app-text-muted",
        "--app-danger",
        "--app-warning",
        "--meal-b",
        "--meal-l",
        "--meal-d",
        "--meal-s",
        "--bg-grid",
        "--paper-grid",
      ]
      vars.forEach((k) => el.style.removeProperty(k))
    }
  }, [themeDef, isDark, colorScheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export { ThemeContext }
