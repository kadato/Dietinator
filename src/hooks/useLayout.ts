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
    const contentMaxWidth = Math.min(width, maxWidths[variant])

    return {
      width,
      isMedium,
      isWide,
      contentMaxWidth,
    }
  }, [width, variant])
}
