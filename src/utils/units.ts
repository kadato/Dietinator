/** Supported unit systems for weight and water display. */
export type UnitSystem = 'metric' | 'imperial';

export function isImperial(units: string): boolean {
  return units === 'imperial';
}

/** Format a weight given in kilograms using the active unit system. */
export function formatWeight(valueKg: number, units: string): string {
  if (isImperial(units)) {
    return `${Math.round(valueKg * 2.2046226 * 10) / 10} lb`;
  }
  return `${valueKg} kg`;
}

/** Format a water amount given in milliliters using the active unit system. */
export function formatWaterAmount(ml: number, units: string): string {
  if (isImperial(units)) {
    return `${Math.round(ml * 0.033814)} fl oz`;
  }
  return `${Math.round(ml / 100) / 10} L`;
}
