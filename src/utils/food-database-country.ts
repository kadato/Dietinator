// Hermes (Android release) implements a subset of Intl and lacks
// Intl.DisplayNames. Guard both so module scope never throws on native.
const regionNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames !== "undefined"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null

export function normalizeFoodDatabaseCountry(code: string): string {
  return code.trim().toUpperCase()
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
