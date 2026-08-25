import { expect, test, type Page } from "./helpers"

/**
 * Real-account serving-size suite: verifies that named YAZIO servings
 * (cup, each, serving, whole, piece, …) surface as chips in add-food and
 * that the calorie preview scales correctly against the live product data.
 *
 * Skips automatically unless YAZIO_EMAIL / YAZIO_PASSWORD are set. Read-only:
 * no diary entries are created or removed.
 *
 * Ground truth (live API, Hungarian food DB, verified 2026-08-10):
 * - "Banán": 0.89 kcal/g; servings cup.sliced (150 g → 134 kcal),
 *   cup.mashed (225 g → 200 kcal).
 */
const EMAIL = process.env.YAZIO_EMAIL
const PASSWORD = process.env.YAZIO_PASSWORD

test.describe("serving sizes (real account)", () => {
  test.skip(!EMAIL || !PASSWORD, "YAZIO_EMAIL/YAZIO_PASSWORD not set")

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(60_000)
  })

  async function login(page: Page) {
    await page.goto("/")
    await expect(page.getByText("Dietinator", { exact: true })).toBeVisible({ timeout: 30_000 })
    await page.getByPlaceholder("YAZIO email").fill(EMAIL!)
    await page.getByPlaceholder("Password").fill(PASSWORD!)
    await page.getByRole("button", { name: /Sign in/i }).click()
    await expect(page.getByRole("button", { name: "Open calendar" })).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.getByText(/YAZIO unavailable/i)).toBeHidden()
  }

  /** Search and open the row whose aria-label starts with the exact product name. */
  async function openFood(page: Page, query: string, productName: string) {
    await page.getByRole("button", { name: "Add food to Lunch" }).click()
    await page.getByPlaceholder("Search foods…").fill(query)
    const row = page.locator(`[aria-label^="${productName} "]`).first()
    // Local cache rows can push remote results below the fold and FlatList
    // only renders visible rows, so scroll until the target row exists in DOM.
    await expect(row)
      .toHaveCount(1, { timeout: 30_000 })
      .catch(async () => {
        for (let i = 0; i < 30; i += 1) {
          if ((await row.count()) > 0) break
          await page.mouse.move(195, 420)
          await page.mouse.wheel(0, 900)
          await page.waitForTimeout(120)
        }
        await expect(row).toHaveCount(1, { timeout: 10_000 })
      })
    await row.scrollIntoViewIfNeeded()
    await row.click()
    await expect(page.getByRole("button", { name: "Add to diary" })).toBeVisible({
      timeout: 30_000,
    })
  }

  async function previewKcal(page: Page): Promise<number> {
    const value = await page.getByTestId("preview-kcal").textContent()
    return Number(value)
  }

  test("cup servings chip in and scale calories correctly", async ({ page }) => {
    await login(page)
    await openFood(page, "banane", "Banán")

    // YAZIO's named cup servings replace the plain 100 g chip once the
    // product detail arrives.
    const sliced = page.getByRole("button", { name: "Serving: Cup Sliced (150 g)" })
    await expect(sliced).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole("button", { name: "Serving: Cup Mashed (225 g)" })).toBeVisible()

    // Default serving is YAZIO's first: cup.sliced 150 g → 0.89 × 150 = 134 kcal.
    expect(await previewKcal(page)).toBe(134)

    // 1 cup mashed (225 g) → 200 kcal.
    await page.getByRole("button", { name: "Serving: Cup Mashed (225 g)" }).click()
    expect(await previewKcal(page)).toBe(200)

    // Free-form amount still scales from the per-100 g reference: 100 g → 89 kcal.
    await page.getByLabel("Amount in g").fill("100")
    expect(await previewKcal(page)).toBe(89)

    // Multi-serving math: 2 sliced cups (300 g) → 267 kcal.
    await page.getByRole("button", { name: "Serving: Cup Sliced (150 g)" }).click()
    await page.getByLabel("Amount in g").fill("300")
    expect(await previewKcal(page)).toBe(267)
  })

  test("serving chips survive a cache round-trip (offline path)", async ({ page }) => {
    await login(page)
    await openFood(page, "banane", "Banán")

    const sliced = page.getByRole("button", { name: "Serving: Cup Sliced (150 g)" })
    await expect(sliced).toBeVisible({ timeout: 30_000 })
    expect(await previewKcal(page)).toBe(134)

    // Close and reopen the same food. Chips must come straight from the cache
    // (servings_json), not from a second network round-trip. An explicit
    // navigation home keeps the reopen deterministic regardless of where the
    // preview's Cancel lands.
    await page.getByRole("button", { name: "Cancel" }).click()
    await page.goto("/")
    await expect(page.getByRole("button", { name: "Open calendar" })).toBeVisible()
    await openFood(page, "banane", "Banán")

    await expect(page.getByRole("button", { name: "Serving: Cup Mashed (225 g)" })).toBeVisible({
      timeout: 5_000,
    })
    await page.getByRole("button", { name: "Serving: Cup Mashed (225 g)" }).click()
    expect(await previewKcal(page)).toBe(200)
  })
})
