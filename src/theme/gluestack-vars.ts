import { darkColors, lightColors } from "@/theme"

/** Convert #RRGGBB to space-separated RGB for gluestack CSS variables. */
export function hexToRgbChannels(hex: string): string {
  const normalized = hex.replace("#", "")
  const value = parseInt(normalized, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `${r} ${g} ${b}`
}

/** Overrides merged into gluestack-ui-provider config (light). */
export const dietinatorLightVars = {
  "--color-background-0": hexToRgbChannels(lightColors.background),
  "--color-background-50": hexToRgbChannels(lightColors.surface),
  "--color-background-100": hexToRgbChannels(lightColors.surfaceAlt),
  "--color-primary-500": hexToRgbChannels(lightColors.primary),
  "--color-primary-600": hexToRgbChannels(lightColors.primaryMuted),
  "--color-typography-900": hexToRgbChannels(lightColors.text),
  "--color-typography-500": hexToRgbChannels(lightColors.textMuted),
  "--color-typography-700": hexToRgbChannels(lightColors.textOnBackground),
  "--color-outline-300": hexToRgbChannels(lightColors.border),
  "--color-error-500": hexToRgbChannels(lightColors.danger),
  "--color-warning-500": hexToRgbChannels(lightColors.warning),
}

/** Overrides merged into gluestack-ui-provider config (dark). */
export const dietinatorDarkVars = {
  "--color-background-0": hexToRgbChannels(darkColors.background),
  "--color-background-50": hexToRgbChannels(darkColors.surface),
  "--color-background-100": hexToRgbChannels(darkColors.surfaceAlt),
  "--color-primary-500": hexToRgbChannels(darkColors.primary),
  "--color-primary-600": hexToRgbChannels(darkColors.primaryMuted),
  "--color-typography-900": hexToRgbChannels(darkColors.text),
  "--color-typography-500": hexToRgbChannels(darkColors.textMuted),
  "--color-typography-700": hexToRgbChannels(darkColors.textOnBackground),
  "--color-typography-950": hexToRgbChannels(darkColors.textOnBackground),
  "--color-outline-300": hexToRgbChannels(darkColors.border),
  "--color-error-500": hexToRgbChannels(darkColors.danger),
  "--color-warning-500": hexToRgbChannels(darkColors.warning),
}
