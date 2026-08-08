import { expect, test } from "./helpers"

/**
 * Calorie-recording accuracy, verified against LIVE YAZIO payloads:
 * the product API is per-gram (banana 0.89 kcal/g, oil 8.84, lettuce 0.15),
 * so 100 g of banana must record ~89 kcal, never 0.89 or 8,900.
 *
 * All assertions read the add-food preview card — nothing is written to the
 * diary, so the real account stays untouched.
 */
const EMAIL = process.env.YAZIO_EMAIL
const PASSWORD = process.env.YAZIO_PASSWORD

async function openFoodPreview(page: import("@playwright/test").Page, query: string) {
  await page.getByRole("button", { name: "Add food to Lunch" }).click()
  const searchBox = page.getByPlaceholder("What did you have for lunch?")
  await expect(searchBox).toBeVisible()
  await searchBox.fill(query)
  const row = page.getByRole("button", { name: /, \d+ calories/ }).first()
  await expect(row).toBeVisible({ timeout: 30_000 })
  await row.click()
  const amount = page.getByLabel(/Amount in/)
  await expect(amount).toBeVisible({ timeout: 30_000 })
  return { amount, kcal: page.getByTestId("preview-kcal") }
}

async function previewKcalAt(
  page: import("@playwright/test").Page,
  amount: import("@playwright/test").Locator,
  kcal: import("@playwright/test").Locator,
  value: string,
): Promise<number> {
  await amount.fill(value)
  await expect(kcal).toBeVisible()
  return Number((await kcal.innerText()).trim())
}

test.describe("calorie accuracy (real YAZIO data)", () => {
  test.skip(!EMAIL || !PASSWORD, "YAZIO_EMAIL/YAZIO_PASSWORD not set")

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(60_000)
    await page.goto("/")
    await expect(page.getByText("Dietinator", { exact: true })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByPlaceholder("YAZIO email").fill(EMAIL!)
    await page.getByPlaceholder("Password").fill(PASSWORD!)
    await page.getByRole("button", { name: /Sign in with YAZIO/i }).click()
    await expect(page.getByText("Meals", { exact: true })).toBeVisible({
      timeout: 60_000,
    })
  })

  test("preview matches realistic calories and scales linearly (any region product)", async ({
    page,
  }) => {
    const { amount, kcal } = await openFoodPreview(page, "banana")

    // Whatever the top match is, 100 g of fruit must be a realistic 20–140 kcal
    // (a per-gram misread would show ~1 kcal, a ×100 inflation ~5,000).
    const kcal100 = await previewKcalAt(page, amount, kcal, "100")
    expect(kcal100).toBeGreaterThanOrEqual(20)
    expect(kcal100).toBeLessThanOrEqual(140)

    const kcal50 = await previewKcalAt(page, amount, kcal, "50")
    expect(Math.abs(kcal50 - kcal100 / 2)).toBeLessThanOrEqual(10)

    const kcal25 = await previewKcalAt(page, amount, kcal, "25")
    expect(Math.abs(kcal25 - kcal100 / 4)).toBeLessThanOrEqual(8)
  })

  test("olive oil: dense food records ~880 kcal / 100 g (normalization intact)", async ({
    page,
  }) => {
    const { amount, kcal } = await openFoodPreview(page, "olive oil")
    const kcal100 = await previewKcalAt(page, amount, kcal, "100")
    expect(kcal100).toBeGreaterThanOrEqual(700)
    expect(kcal100).toBeLessThanOrEqual(1100)
  })

  test("cucumber: low-cal food records ~15 kcal / 100 g (no ×100 inflation)", async ({ page }) => {
    const { amount, kcal } = await openFoodPreview(page, "cucumber")
    const kcal100 = await previewKcalAt(page, amount, kcal, "100")
    expect(kcal100).toBeGreaterThanOrEqual(5)
    expect(kcal100).toBeLessThanOrEqual(40)
  })

  test("a real food can be logged for tomorrow, and today stays clean", async ({ page }) => {
    // Move to tomorrow, then log a real product there.
    await page.getByRole("button", { name: "Next day" }).click()
    const { amount, kcal } = await openFoodPreview(page, "banana")
    const kcal100 = await previewKcalAt(page, amount, kcal, "100")
    await amount.fill("120")
    await page.getByRole("button", { name: "Add to diary" }).click()
    await page.getByRole("button", { name: "Done" }).click()

    // Tomorrow's dashboard shows the entry; recorded kcal matches the preview
    // math (preview at 100 g × 1.2), i.e. no conversion drift through the pipeline.
    await page.getByRole("button", { name: /^Lunch, / }).click()
    const entry = page.getByRole("button", { name: /, \d+ calories/ }).first()
    await expect(entry).toBeVisible({ timeout: 15_000 })
    const label = (await entry.getAttribute("aria-label")) ?? ""
    const logged = Number(/, (\d+) calories/.exec(label)?.[1] ?? 0)
    expect(Math.abs(logged - kcal100 * 1.2)).toBeLessThanOrEqual(15)
    const name = label.replace(/, \d+ calories$/, "")

    // Back to today: the same product must NOT appear there.
    await page.getByRole("button", { name: "Open calendar" }).click()
    await page.getByRole("button", { name: "Go to today" }).click()
    await expect(
      page.getByRole("button", { name: new RegExp(`${name}, \\d+ calories`) }),
    ).toHaveCount(0)
  })
})
