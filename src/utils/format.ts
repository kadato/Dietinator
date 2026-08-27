/**
 * Format a number with at most `maxDecimals` decimals, stripping trailing
 * zeros ("75.50" becomes "75.5", "80.00" becomes "80"). Falls back to "0" for
 * non-finite values. Every user-facing number in the app goes through this
 * (or an equivalent Math.round) so floats never show more than 2 decimals.
 */
export function formatNumber(value: number, maxDecimals = 2): string {
  if (!Number.isFinite(value)) return "0"
  const fixed = value.toFixed(maxDecimals)
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
}

/** One-decimal gram formatting used by macro pills and accessible names. */
export function formatMacro(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** Locale-free thousands separator: 1234 -> "1,234". Avoids Intl on Android. */
export function formatThousands(value: number): string {
  if (!Number.isFinite(value)) return "0"
  const int = String(Math.round(value))
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

/** Format an ISO date as HH:MM (24h) without Intl. */
export function formatTimeHM(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  return `${h}:${m}`
}
