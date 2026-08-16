import { expect, test, bootAuthenticated, openSettingsSection } from "./helpers"

/**
 * Geometry checks for the modal/statistics UI rework. Verifies with DOM
 * measurements instead of screenshots:
 *  - calories chart renders SVG bars
 *  - exactly one "Log weight" button per state
 *  - log-weight opens as an overlay modal (no navigation)
 *  - cancel FAB sits outside the centered dialog on desktop; backdrop tap
 *    dismisses
 *  - AI composer input is one-line tall (vertically centered placeholder)
 */
test.describe("ui rework geometry checks", () => {
  async function quickAdd(page: import("@playwright/test").Page, kcal: string) {
    await page.getByRole("button", { name: "Add food to Snacks" }).click()
    await expect(page.getByRole("button", { name: "More" })).toBeVisible()
    await page.getByRole("button", { name: "More" }).click()
    await page.getByRole("button", { name: "Quick Add" }).click()
    await expect(page.getByRole("textbox", { name: "Calories" })).toBeVisible()
    await page.getByRole("textbox", { name: "Calories" }).fill(kcal)
    await page.getByRole("button", { name: "Add to diary" }).click()
    // Sections start collapsed — expand Snacks to reveal the entry.
    await page.getByRole("button", { name: /^Snacks, / }).click()
    await expect(page.getByText("Quick add", { exact: true })).toBeVisible({ timeout: 15_000 })
  }

  test("bars, single button, modal geometry", async ({ page }) => {
    await bootAuthenticated(page)

    // Seed two days of calories (today + yesterday).
    await quickAdd(page, "320")
    // exact: the header also has a "Copy previous day" action button.
    await page.getByRole("button", { name: "Previous day", exact: true }).click()
    await quickAdd(page, "180")
    await page.getByRole("button", { name: "Next day" }).click()

    await page.getByRole("tab", { name: "Stats" }).click()
    await expect(page.getByText("Body weight", { exact: true })).toBeVisible()

    // Exactly one Log weight button (empty-state copy only).
    await expect(page.getByRole("button", { name: "Log weight" })).toHaveCount(1)

    // Calorie chart draws SVG bars (auto-waiting first, then count).
    await expect(page.locator("svg rect").first()).toBeVisible()
    const barCount = await page.locator("svg rect").count()
    expect(barCount).toBeGreaterThan(0)

    // The x axis is range-based: today is always the last tick and the axis
    // shows ~6 labels regardless of how few data points exist. The label is
    // computed in the browser so it matches the app's locale, not Node's.
    const todayLabel = await page.evaluate(() =>
      new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    )
    await expect(page.getByText(todayLabel, { exact: true }).first()).toBeVisible()
    const tickCount = await page.locator("svg text").count()
    expect(tickCount).toBeGreaterThan(5)

    // Weight chart empty state: log a weight, then the actions row appears.
    await page.getByRole("button", { name: "Log weight" }).click()
    await expect(page.getByRole("textbox", { name: "Weight" })).toBeVisible()
    // Overlay modal: URL does not change.
    expect(page.url()).toContain("/stats")
    await page.getByRole("textbox", { name: "Weight" }).fill("75.5")
    await page.getByRole("button", { name: "Save weight" }).click()

    // After saving: still exactly one Log weight button (action row, chart shown).
    await expect(page.getByText("75.5 kg", { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole("button", { name: "Log weight" })).toHaveCount(1)
    await expect(page.getByRole("button", { name: "Delete latest weight" })).toBeVisible()
  })

  test("cancel FAB sits outside the dialog on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await bootAuthenticated(page)

    await page.getByRole("tab", { name: "Stats" }).click()
    await page.getByRole("button", { name: "Log weight" }).first().click()
    await expect(page.getByRole("textbox", { name: "Weight" })).toBeVisible()

    const dialog = await page.locator('[data-testid="log-weight-dialog"]').boundingBox()
    const cancel = await page.getByRole("button", { name: "Cancel" }).boundingBox()
    expect(dialog).not.toBeNull()
    expect(cancel).not.toBeNull()
    // Cancel FAB must not overlap the dialog column.
    const overlap =
      cancel!.x < dialog!.x + dialog!.width &&
      cancel!.x + cancel!.width > dialog!.x &&
      cancel!.y < dialog!.y + dialog!.height &&
      cancel!.y + cancel!.height > dialog!.y
    expect(overlap).toBe(false)
    // The dialog itself is centered both ways and narrower than the viewport.
    expect(dialog!.width).toBeLessThan(700)
    expect(Math.abs(dialog!.x + dialog!.width / 2 - 640)).toBeLessThan(20)
    expect(Math.abs(dialog!.y + dialog!.height / 2 - 400)).toBeLessThan(20)

    // Backdrop tap dismisses.
    await page.mouse.click(20, 20)
    await expect(page.getByRole("textbox", { name: "Weight" })).toBeHidden()
  })

  test("AI chat composer input is symmetric (centered placeholder)", async ({ page }) => {
    // Desktop layout: the tab bar becomes a left sidebar on wide screens.
    await page.setViewportSize({ width: 1280, height: 800 })
    await bootAuthenticated(page)

    // Enable the assistant so the AI tab appears with a live composer.
    await openSettingsSection(page, "AI Assistant settings")
    await page.getByRole("switch", { name: "Enable AI assistant" }).click()
    await page.getByRole("tab", { name: "AI" }).click()
    await expect(page.getByText("Dietinator AI", { exact: true })).toBeVisible()

    const input = page.getByRole("textbox", { name: "Message the AI assistant" })
    await expect(input).toBeVisible()

    const box = await input.boundingBox()
    expect(box).not.toBeNull()
    // The input fills the composer pill height and uses symmetric padding, so
    // the placeholder is vertically centered by construction.
    expect(box!.height).toBeGreaterThanOrEqual(42)
    expect(box!.height).toBeLessThanOrEqual(46)

    // Leave AI disabled for other specs.
    await openSettingsSection(page, "AI Assistant settings")
    await page.getByRole("switch", { name: "Enable AI assistant" }).click()
  })
})
