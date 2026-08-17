import { expect, test, bootAuthenticated, openSettingsSection } from "./helpers"

/**
 * Demo mode and full backup/restore round-trip. Both are offline paths:
 * demo seeds a fake local session, backup never touches the network.
 */

/** Simulate a long-press on an element (RN long-press affordance). */
async function longPress(page: import("@playwright/test").Page, selector: string) {
  // Meal rows sit below the fold on the phone viewport — scrolling is
  // required for the synthetic mouse events to reach the element.
  const target = page.locator(selector)
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  if (!box) throw new Error(`No bounding box for ${selector}`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(700)
  await page.mouse.up()
}

test.describe("demo mode", () => {
  test("seeds an explorable session from the login screen", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible()

    await page.getByRole("button", { name: "Try the demo" }).click()

    await expect(page.getByRole("button", { name: "Open calendar" })).toBeVisible({
      timeout: 30_000,
    })
    // Meal sections start collapsed — expand Breakfast and Snacks to reveal
    // the seeded entries.
    await page.getByRole("button", { name: /^Breakfast, / }).click()
    await expect(page.getByText("Oatmeal, cooked", { exact: false })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole("button", { name: /^Snacks, / }).click()
    await expect(page.getByText("Banana", { exact: false })).toBeVisible()
  })

  test("?demo=1 boots straight into a demo session", async ({ page }) => {
    await page.goto("/?demo=1")
    await expect(page.getByRole("button", { name: "Open calendar" })).toBeVisible({
      timeout: 30_000,
    })
    // Sections start collapsed — expand Breakfast to reveal the oatmeal entry.
    await page.getByRole("button", { name: /^Breakfast, / }).click()
    await expect(page.getByText("Oatmeal, cooked", { exact: false })).toBeVisible({
      timeout: 15_000,
    })
  })
})

test.describe("backup and restore (offline)", () => {
  test("export downloads a JSON backup and restore round-trips it", async ({ page }) => {
    await bootAuthenticated(page)

    // Seed a recognizable entry via Quick Add.
    await page.getByRole("button", { name: "Add food to Snacks" }).click()
    await page.getByRole("button", { name: "More" }).click()
    await page.getByRole("button", { name: "Quick Add" }).click()
    await expect(page.getByRole("textbox", { name: "Calories" })).toBeVisible()
    await page.getByRole("textbox", { name: "Calories" }).fill("777")
    await page.getByRole("button", { name: "Add to diary" }).click()
    // The section stays collapsed — the header total proves the entry landed.
    await expect(page.getByRole("button", { name: /^Snacks, 777/ })).toBeVisible({
      timeout: 15_000,
    })

    // Export: intercept the browser download.
    await page.getByRole("tab", { name: /Settings/ }).click()
    await expect(page.getByRole("button", { name: "Goals & Nutrition settings" })).toBeVisible()
    await page.getByRole("button", { name: "Data & Backup settings" }).click()
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Back up all data" }).click(),
    ])
    const backupPath = await download.path()
    expect(backupPath).toBeTruthy()

    // Delete the entry locally.
    await page.getByRole("tab", { name: /Today/ }).click()
    await page.getByRole("button", { name: /^Snacks, / }).click()
    const row = page.getByRole("button", { name: /^Quick add, / })
    await expect(row).toHaveCount(1)
    page.once("dialog", (dialog) => void dialog.accept())
    await longPress(page, '[aria-label^="Quick add,"]')
    await expect(row).toHaveCount(0, { timeout: 15_000 })

    // Restore from the downloaded file: confirm dialog, then file picker.
    // (Tab screens stay mounted, so the drilldown may still be open — the
    // helper returns to the hub first.)
    await openSettingsSection(page, "Data & Backup settings")
    page.once("dialog", (dialog) => void dialog.accept())
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: "Restore from backup" }).click(),
    ])
    await chooser.setFiles(backupPath!)
    await expect(page.getByText("Backup restored", { exact: false })).toBeVisible({
      timeout: 15_000,
    })

    // The entry is back on the dashboard (section state may reset between
    // tab switches, so assert the collapsed header total instead of a row).
    await page.getByRole("tab", { name: /Today/ }).click()
    await expect(page.getByRole("button", { name: /^Snacks, 777/ })).toBeVisible({
      timeout: 15_000,
    })
  })
})
