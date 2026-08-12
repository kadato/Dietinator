/**
 * Convert a hex color (with optional alpha suffix, e.g. "#0f766e22") into an
 * `rgba()` string. Used when a theme token must render at reduced opacity in
 * a place that takes CSS colors (shadows, borders, fills). Works with the
 * app's palette, which is hex-only; callers must not pass rgba/named colors.
 */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "")
  const full = clean.length === 8 ? clean.slice(0, 6) : clean
  const parsed = Number.parseInt(full, 16)
  if (Number.isNaN(parsed)) return hex
  const r = (parsed >> 16) & 0xff
  const g = (parsed >> 8) & 0xff
  const b = parsed & 0xff
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Blend two solid hex colors into a solid hex string; `amount` is the share
 * of `tint` (0–1). Use instead of alpha when the result must stay opaque —
 * translucent fills let content behind them bleed through (toast cards).
 */
export function mixColors(base: string, tint: string, amount: number): string {
  const toRgb = (hex: string): [number, number, number] => {
    const clean = hex.replace("#", "").slice(0, 6)
    const parsed = Number.parseInt(clean, 16)
    if (Number.isNaN(parsed)) return [0, 0, 0]
    return [(parsed >> 16) & 0xff, (parsed >> 8) & 0xff, parsed & 0xff]
  }
  const [br, bg, bb] = toRgb(base)
  const [tr, tg, tb] = toRgb(tint)
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount)
  const toHex = (v: number) => v.toString(16).padStart(2, "0")
  return `#${toHex(mix(br, tr))}${toHex(mix(bg, tg))}${toHex(mix(bb, tb))}`
}
