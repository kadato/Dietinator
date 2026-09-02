import { useContext } from "react"
import { useColorScheme } from "react-native"
import { getColors } from "@/theme"
import { ThemeContext, type AppColorScheme } from "@/context/ThemeContext"

/**
 * Theme colors for the current render. Inside ThemeProvider this follows the
 * user's explicit preference (Settings, then Theme); without a provider (for example
 * unit tests) it falls back to the OS scheme.
 *
 * Future themes: if `registerCustomTheme(name, palette)` was called, this hook
 * will return that palette when `theme_preference` equals `name`.
 */
export function useTheme() {
  const ctx = useContext(ThemeContext)
  const systemScheme = useColorScheme()
  if (ctx) {
    return { colors: ctx.colors, colorScheme: ctx.colorScheme, isDark: ctx.isDark }
  }
  const colorScheme: AppColorScheme = systemScheme === "light" ? "light" : "dark"
  return {
    colors: getColors(systemScheme),
    colorScheme,
    isDark: colorScheme === "dark",
  }
}
