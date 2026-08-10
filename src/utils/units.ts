/** Supported unit systems for weight and water display. */
export type UnitSystem = "metric" | "imperial"

export function isImperial(units: string): boolean {
  return units === "imperial"
}

/** Format a weight given in kilograms using the active unit system. */
export function formatWeight(valueKg: number, units: string): string {
  if (isImperial(units)) {
    return `${Math.round(valueKg * 2.2046226 * 10) / 10} lb`
  }
  return `${valueKg} kg`
}

/** Convert a weight in the active unit system to kilograms (storage unit). */
export function weightToKg(value: number, units: string): number {
  return isImperial(units) ? value / 2.2046226 : value
}

/**
 * Parse a user-entered weight ("82.5", "82,5") in the active unit system.
 * Returns kilograms, or null when the text is not a valid positive weight.
 */
export function parseWeightInput(text: string, units: string): number | null {
  const normalized = text.trim().replace(",", ".")
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0 || value > 2000) return null
  return weightToKg(value, units)
}

/** Format a water amount given in milliliters using the active unit system. */
export function formatWaterAmount(ml: number, units: string): string {
  if (isImperial(units)) {
    return `${Math.round(ml * 0.033814)} fl oz`
  }
  return `${Math.round(ml / 100) / 10} L`
}
