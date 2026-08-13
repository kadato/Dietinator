/**
 * Format a number with at most `maxDecimals` decimals, stripping trailing
 * zeros ("75.50" → "75.5", "80.00" → "80"). Falls back to "0" for
 * non-finite values. Every user-facing number in the app goes through this
 * (or an equivalent Math.round) so floats never show more than 2 decimals.
 */
export function formatNumber(value: number, maxDecimals = 2): string {
  if (!Number.isFinite(value)) return "0"
  const fixed = value.toFixed(maxDecimals)
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
}
