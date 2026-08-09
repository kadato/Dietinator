import { useContext } from "react"
import { useColorScheme } from "react-native"
import { getColors } from "@/theme"
import { ThemeContext, type AppColorScheme } from "@/context/ThemeContext"

/**
 * Theme colors for the current render. Inside ThemeProvider this follows the
 * user's explicit preference (Settings → Theme); without a provider (e.g.
 * unit tests) it falls back to the OS scheme.
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
