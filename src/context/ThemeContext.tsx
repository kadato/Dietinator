import React, { createContext, useMemo } from "react"
import { useColorScheme } from "react-native"
import { getColors, type ColorPalette } from "@/theme"
import { useApp } from "./AppContext"

export type AppColorScheme = "light" | "dark"

type ThemeContextValue = {
  colors: ColorPalette
  colorScheme: AppColorScheme
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Resolves the effective color scheme from the user's explicit theme
 * preference (Settings) falling back to the OS scheme. Must be mounted
 * inside AppProvider; wrap the UI (incl. GluestackUIProvider) in it.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useApp()
  const systemScheme = useColorScheme()
  const preference = settings.theme_preference ?? "system"

  const colorScheme: AppColorScheme =
    preference === "system" ? (systemScheme === "light" ? "light" : "dark") : preference

  const value = useMemo(
    () => ({
      colors: getColors(colorScheme),
      colorScheme,
      isDark: colorScheme === "dark",
    }),
    [colorScheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export { ThemeContext }
