import { borders, radii } from "./tokens"
import type { ColorPalette } from "./palette"
import { cardStyle, borderStyle, wellStyle } from "./helpers"

/**
 * Shared StyleSheet fragments. Each helper returns the minimal object
 * so callers can spread it without overriding palette-dependent values.
 *
 * Goal: eliminate 100+ copies of `borderWidth: borders.width, borderColor: colors.border,
 * borderRadius: radii.none, boxShadow: "none", elevation: 0`.
 *
 * This module re-exports the helpers from `helpers.ts` under StyleSheet-friendly
 * aliases so existing code can migrate gradually. New code should import from
 * `@/theme` or `@/theme/helpers` directly.
 */

/** Flat primitive - square with no shadow. */
export const flat = {
  borderRadius: radii.none,
  boxShadow: "none" as const,
  elevation: 0,
} as const

/** Base border - ink rule with square corners. Alias of `borderStyle`. */
export const borderBase = borderStyle
/** Card chrome: surface + ink rule, flat. Alias of `cardStyle`. */
export const cardBase = cardStyle
/** Muted well: surfaceAlt + ink rule, flat. Alias of `wellStyle`. */
export const wellBase = wellStyle

/** Thin variant for inner chip rules (1px). */
export function thinBorder(colors: ColorPalette) {
  return {
    borderWidth: borders.widthThin,
    borderColor: colors.border,
    borderRadius: radii.none,
  }
}

/** Row separator - bottom rule with translucent border. */
export function rowSeparator(border: string) {
  return {
    borderBottomWidth: borders.widthThin,
    borderBottomColor: border,
  }
}
