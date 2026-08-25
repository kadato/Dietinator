import { useMemo } from "react"
import { useWindowDimensions } from "react-native"
import { layout } from "@/theme"

export type LayoutVariant = "default" | "wide" | "narrow"

const maxWidths: Record<LayoutVariant, number> = {
  narrow: layout.maxWidthNarrow,
  default: layout.maxWidthContent,
  wide: layout.maxWidthWide,
}

export function useLayout(variant: LayoutVariant = "default") {
  const { width } = useWindowDimensions()

  return useMemo(() => {
    const isMedium = width >= layout.breakpointMedium
    const isWide = width >= layout.breakpointWide
    const isLarge = width >= layout.breakpointLarge
    const isXl = width >= layout.breakpointXl
    // On large desktops the wide container grows to 1360 so the diary does
    // not sit as a narrow column in a sea of grid. Narrow and default keep
    // their caps for focused reading.
    const effectiveMax = isLarge && variant === "wide" ? layout.maxWidthXl : maxWidths[variant]
    const contentMaxWidth = Math.min(width, effectiveMax)

    return {
      width,
      isMedium,
      isWide,
      isLarge,
      isXl,
      contentMaxWidth,
    }
  }, [width, variant])
}
