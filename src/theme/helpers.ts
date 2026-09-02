import type { ColorPalette } from "./palette"
import { borders, radii, tints, overlays } from "./tokens"
import { withAlpha } from "@/utils/color"

export { borders, radii, tints, overlays }

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

/** Flat helper: removes shadow/elevation, forces square. */
export const flat = {
  borderRadius: radii.none,
  boxShadow: "none" as const,
  elevation: 0,
} as const

/** Reusable well style: muted ground with ink rule. */
export function wellStyle(colors: ColorPalette) {
  return {
    backgroundColor: colors.surfaceAlt,
    borderWidth: borders.width,
    borderColor: colors.border,
    borderRadius: radii.none,
    boxShadow: "none" as const,
    elevation: 0,
  }
}

/** Input / field style: surface sheet with ink rule. */
export function inputStyle(colors: ColorPalette) {
  return {
    backgroundColor: colors.surface,
    borderWidth: borders.width,
    borderColor: colors.border,
    borderRadius: radii.none,
    boxShadow: "none" as const,
    elevation: 0,
  }
}

/** Chip / pill style helper - deduplicates the 5-prop pill pattern. */
export function chipStyle(accent: string, opts?: { alpha?: number; borderAlpha?: number }) {
  return {
    backgroundColor: chipTint(accent, opts?.alpha ?? tints.chip),
    borderColor: chipTint(accent, opts?.borderAlpha ?? 0.4),
    borderWidth: borders.width,
    borderRadius: radii.none,
    boxShadow: "none" as const,
    elevation: 0,
  }
}

/** Outline tint for chip border without solid fill. */
export function chipBorder(accent: string, alpha = 0.4): string {
  return chipTint(accent, alpha)
}

/** Surface-alt well with subtle overlay tint. */
export function surfaceWellStyle(colors: ColorPalette, accent?: string) {
  if (!accent) return wellStyle(colors)
  return {
    backgroundColor: chipTint(accent),
    borderWidth: borders.width,
    borderColor: colors.border,
    borderRadius: radii.none,
    boxShadow: "none" as const,
    elevation: 0,
  }
}

/** Pressed state helper - consistent across rows and cards. */
export function pressedStyle(colors: ColorPalette) {
  return {
    backgroundColor: colors.surfaceAlt,
    opacity: 0.9,
  }
}

/** Bar track style */
export function barTrackStyle(colors: ColorPalette) {
  return {
    backgroundColor: colors.surfaceAlt,
    borderWidth: borders.width,
    borderColor: colors.border,
    borderRadius: radii.none,
    overflow: "hidden" as const,
    boxShadow: "none" as const,
    elevation: 0,
  }
}

/** Top highlight for bar fills */
export const barHighlight = {
  borderTopWidth: borders.width,
  borderTopColor: overlays.highlight,
} as const
