import { test as base, expect, type Page } from "@playwright/test"

export type { Page } from "@playwright/test"

/**
 * The app gates every screen behind auth. For local-first tests we seed the
 * web secure-storage fallback flag so the app boots into the tabs without
 * touching the network. YAZIO stays unreachable → offline banner shows and
 * the diary works from SQLite/OPFS only, exactly the offline path.
 */
export const AUTH_FLAG_KEY = "calorie_tracker_yazio_logged_in"

export async function seedAuthenticated(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "1")
  }, AUTH_FLAG_KEY)
}

export async function bootAuthenticated(page: Page): Promise<void> {
  await seedAuthenticated(page)
  await page.goto("/")
  // The Today screen's calendar button is unique to the dashboard.
  await expect(page.getByRole("button", { name: "Open calendar" })).toBeVisible({
    timeout: 30_000,
  })
}

/**
 * Settings is a hub + drilldown, and tab screens stay mounted, so a drilldown
 * survives tab switches. Return to the hub (when a section is already open)
 * before opening another one. Section rows carry no aria-label (2.5.3
 * label-in-name), so their accessible name is the visible "Title + subtitle";
 * callers pass "Goals and Nutrition settings" style labels and the " settings"
 * suffix is stripped here.
 */
export async function openSettingsSection(page: Page, label: string): Promise<void> {
  await page.getByRole("tab", { name: /Settings/ }).click()
  const back = page.getByRole("button", { name: "Back to all settings" })
  if ((await back.count()) > 0) {
    await back.click()
  }
  await page.getByRole("button", { name: label.replace(/ settings$/, "") }).click()
}

export const test = base
export { expect }
