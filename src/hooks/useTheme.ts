import { useColorScheme } from "react-native"
import { getColors } from "@/theme"

export function useTheme() {
  const colorScheme = useColorScheme()
  const colors = getColors(colorScheme)
  const isDark = colorScheme !== "light"

  return { colors, colorScheme, isDark }
}
