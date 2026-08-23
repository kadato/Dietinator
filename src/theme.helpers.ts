import type { ColorPalette } from "./theme"
import { borders, radii, tints } from "./theme"
import { withAlpha } from "@/utils/color"

export { borders, radii, tints }

/**
 * Shared chip / pill ground tint. Keeps the 14% rule in one place so
 * contrast fixes stay centralized. Use for macro pills, budget badges and
 * icon wells on tinted grounds.
 */
export function chipTint(accent: string, alpha: number = tints.chip): string {
  return withAlpha(accent, alpha)
}

/**
 * Card / sheet chrome: surface + 1.5px ink rule, flat, no shadow.
 * Terminal depth is rule weight and invert, never lift.
 */
export function cardStyle(colors: ColorPalette) {
  return {
    backgroundColor: colors.surface,
    borderWidth: borders.width,
    borderColor: colors.border,
    borderRadius: radii.none,
    boxShadow: "none" as const,
    elevation: 0,
  }
}

export function borderStyle(colors: ColorPalette) {
  return {
    borderWidth: borders.width,
    borderColor: colors.border,
    borderRadius: radii.none,
  }
}

export function iconBoxStyle(accent: string, colors: ColorPalette) {
  return {
    backgroundColor: chipTint(accent),
    borderWidth: borders.width,
    borderColor: colors.border,
    borderRadius: radii.none,
  }
}
