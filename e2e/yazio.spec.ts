import { expect, test, type Page } from "./helpers"

/**
 * Real-account YAZIO suite.
 *
 * Skips automatically unless YAZIO_EMAIL / YAZIO_PASSWORD are set (from
 * .env.local). These tests hit the live YAZIO API through the app's proxy and
 * exercise the true login, search, log, sync, and delete flows.
 *
 * Side effects on the real YAZIO account are kept minimal: one consumed item is
 * created and then removed again at the end of the sync test.
 *
 * Foods are targeted by name (aria-labels start with the product name): a real
 * account's "Frequent" list leads with the user's most-used foods, so picking
 * the first row would log (and later delete) the wrong product.
 */
const EMAIL = process.env.YAZIO_EMAIL
const PASSWORD = process.env.YAZIO_PASSWORD

test.describe("YAZIO (real account)", () => {
  test.skip(!EMAIL || !PASSWORD, "YAZIO_EMAIL/YAZIO_PASSWORD not set")

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(60_000)
  })

  async function login(page: Page) {
    await page.goto("/")
    await expect(page.getByText("Dietinator", { exact: true })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByPlaceholder("YAZIO email").fill(EMAIL!)
    await page.getByPlaceholder("Password").fill(PASSWORD!)
    await page.getByRole("button", { name: /Sign in/i }).click()
    // Login imports today's diary from YAZIO, so wait for the dashboard to settle.
    await expect(page.getByRole("button", { name: "Open calendar" })).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.getByText(/YAZIO unavailable/i)).toBeHidden()
  }

  async function logFoodViaSearch(page: Page, meal: string, query: string, foodName: string) {
    await page.getByRole("button", { name: `Add food to ${meal}` }).click()
    const searchBox = page.getByPlaceholder("Search foods…")
    await expect(searchBox).toBeVisible()
    await searchBox.fill(query)

    const row = page.locator(`[aria-label^="${foodName}, "]`).first()
    await expect(row).toBeVisible({ timeout: 30_000 })
    await row.click()

    // add-food modal opens with the product; save with the default amount.
    await expect(page.getByRole("button", { name: "Add to diary" })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole("button", { name: "Add to diary" }).click()

    // Back in the log-meal modal → close it via the cancel FAB to reach the dashboard.
    await page.getByRole("button", { name: "Cancel" }).click()
  }

  /** The diary row for a specific food (labels end with `<name>, …, N kcal`). */
  function mealEntry(page: Page, foodName: string) {
    return page.getByRole("button", { name: new RegExp(`^${foodName}, .* \\d+ kcal$`) }).first()
  }

  test("signs in with real credentials and reaches the dashboard", async ({ page }) => {
    await login(page)
    await expect(page.getByRole("button", { name: "Open calendar" })).toBeVisible()
    // The scanner lives inside food tracking, not on the dashboard.
    await expect(page.getByRole("button", { name: "Scan barcode" })).toBeHidden()
    await page.getByRole("button", { name: "Add food to Lunch" }).click()
    await expect(page.getByRole("button", { name: "Scan" })).toBeVisible()
    await page.getByRole("button", { name: "Cancel" }).click()
  })

  test("searches the live YAZIO food database", async ({ page }) => {
    await login(page)

    await page.getByRole("button", { name: "Add food to Lunch" }).click()
    await page.getByPlaceholder("Search foods…").fill("banane")

    // Remote results arrive with real product rows (aria-label ends with the
    // kcal + Cal summary: "<name>, <portion>, <kcal> kcal, …, <kcal> Cal").
    const rows = page.locator('[aria-label$=" Cal"]')
    await expect(rows.first()).toBeVisible({ timeout: 30_000 })
    expect(await rows.count()).toBeGreaterThan(0)
  })

  test("logs a real YAZIO food into the diary", async ({ page }) => {
    await login(page)
    await logFoodViaSearch(page, "Lunch", "banane", "Banán")

    // Back on the dashboard, the lunch card lists the entry. Wait for the
    // focus-reload to land before clicking. An empty section header navigates
    // to log-meal instead of expanding.
    await expect(page.getByRole("button", { name: /^Lunch, [1-9]\d* kcal/ })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole("button", { name: /^Lunch, / }).click()
    const entry = mealEntry(page, "Banán")
    await expect(entry).toBeVisible({ timeout: 15_000 })
  })

  test("syncs an entry to YAZIO and deletes it (both sides)", async ({ page }) => {
    await login(page)

    // Enable best-effort sync (lives in the YAZIO Sync settings section).
    await page.getByRole("tab", { name: /Settings/ }).click()
    await page.getByRole("button", { name: "YAZIO Sync settings" }).click()
    await page.getByRole("switch", { name: "Sync diary to YAZIO" }).click()
    await expect(page.getByRole("switch", { name: "Sync diary to YAZIO" })).toBeChecked()

    await page.getByRole("tab", { name: /Today/ }).click()
    await logFoodViaSearch(page, "Dinner", "banane", "Banán")

    // Wait for the entry, then delete it (long-press → confirm).
    await expect(page.getByRole("button", { name: /^Dinner, [1-9]\d* kcal/ })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole("button", { name: /^Dinner, / }).click()
    const entry = mealEntry(page, "Banán")
    await expect(entry).toBeVisible({ timeout: 15_000 })

    // Accept the confirmation dialog BEFORE clicking delete. The visible
    // delete button is the one users have; the former hidden long-press
    // path was removed from the row.
    page.once("dialog", (dialog) => void dialog.accept())
    await entry.scrollIntoViewIfNeeded()
    await page.getByRole("button", { name: "Delete Banán" }).click()

    await expect(entry).toBeHidden({ timeout: 15_000 })
  })
})
