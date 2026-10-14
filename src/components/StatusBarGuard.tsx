import { View, Platform, StatusBar } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/hooks/useTheme"
import { useLayout } from "@/hooks/useLayout"

type Props = {
  backgroundColor?: string
}

/**
 * Defends the mobile top status bar area (clock, battery, camera hole cutout, notch)
 * by rendering a solid theme-colored spacer outside the scrollable view hierarchy.
 *
 * This prevents scrolling content from passing behind the system status bar,
 * keeping the time, battery, and icons perfectly legible while framing the camera hole nicely.
 */
export function StatusBarGuard({ backgroundColor }: Props) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { isWide } = useLayout()

  // On wide screens (desktop web) there is no mobile status bar.
  if (isWide) return null

  // On native phones, insets.top covers notch, Dynamic Island, status bar, and camera cutout.
  // Fall back to Android currentHeight on native Android if insets.top isn't reported yet.
  const nativeTop = Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 0
  const topInset = insets.top > 0 ? insets.top : Platform.OS !== "web" ? nativeTop : 0

  if (topInset <= 0) return null

  return (
    <View
      style={{
        height: topInset,
        width: "100%",
        backgroundColor: backgroundColor ?? colors.background,
        zIndex: 100,
      }}
      pointerEvents="none"
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
    />
  )
}
