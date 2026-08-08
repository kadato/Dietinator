import {
  FOOD_DATABASE_COUNTRY_CODES,
  type FoodDatabaseCountryCode,
} from "@/constants/food-database-countries"

const regionNames =
  typeof Intl !== "undefined" ? new Intl.DisplayNames(["en"], { type: "region" }) : null

const validCodes = new Set<string>(FOOD_DATABASE_COUNTRY_CODES)

export function normalizeFoodDatabaseCountry(code: string): string {
  return code.trim().toUpperCase()
}

export function isKnownFoodDatabaseCountry(code: string): code is FoodDatabaseCountryCode {
  return validCodes.has(normalizeFoodDatabaseCountry(code))
}

export function getFoodDatabaseCountryLabel(code: string): string {
  const normalized = normalizeFoodDatabaseCountry(code)
  if (!normalized) return ""
  const name = regionNames?.of(normalized)
  return name ? `${name} (${normalized})` : normalized
}

/** Settings override, then YAZIO profile, then DE. */
export function resolveFoodDatabaseCountry(
  settingsCountry: string,
  profileCountry?: string | null,
): string {
  const fromSettings = settingsCountry?.trim()
  if (fromSettings) return normalizeFoodDatabaseCountry(fromSettings)
  const fromProfile = profileCountry?.trim()
  if (fromProfile) return normalizeFoodDatabaseCountry(fromProfile)
  return "DE"
}
