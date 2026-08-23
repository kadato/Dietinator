import { expect, test, bootAuthenticated } from "./helpers"

test.describe("diary flows (offline, local-first)", () => {
  /** Dashboard → log-meal modal → "More" → create-options. */
  async function openCreateOptions(page: import("@playwright/test").Page, meal: string) {
    await page.getByRole("button", { name: `Add food to ${meal}` }).click()
    await expect(page.getByRole("button", { name: "More" })).toBeVisible()
    await page.getByRole("button", { name: "More" }).click()
    await expect(page.getByText("What would you like to log or create?")).toBeVisible()
  }

  test("quick add a manual entry and see it on the dashboard", async ({ page }) => {
    await bootAuthenticated(page)

    await openCreateOptions(page, "Snacks")
    await page.getByRole("button", { name: "Quick Add" }).click()
    // The create-options card behind the modal also says "Quick Add", so assert the form instead.
    await expect(page.getByRole("textbox", { name: "Calories" })).toBeVisible()

    await page.getByRole("textbox", { name: "Calories" }).fill("320")
    await page.getByRole("button", { name: "Add to diary" }).click()

    // Back on the dashboard, expand the snack card to reveal the entry.
    await page.getByRole("button", { name: /^Snacks, / }).click()
    await expect(page.getByText("Quick add", { exact: true })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("manual entry with a name and macros", async ({ page }) => {
    await bootAuthenticated(page)

    await openCreateOptions(page, "Lunch")
    await page.getByRole("button", { name: "New food" }).click()
    await expect(page.getByText("Manual entry", { exact: true })).toBeVisible()

    await page.getByLabel("Food name").fill("Homemade soup")
    await page.getByRole("textbox", { name: "Calories" }).fill("250")
    await page.getByLabel("Protein (g)").fill("12")
    await page.getByRole("button", { name: "Add to diary" }).click()

    // Expand the lunch card to reveal the new entry.
    await page.getByRole("button", { name: /^Lunch, / }).click()
    await expect(page.getByText("Homemade soup", { exact: true })).toBeVisible()
  })

  test("delete asks for confirmation and removes the entry", async ({ page }) => {
    await bootAuthenticated(page)

    // Seed an entry first.
    await openCreateOptions(page, "Dinner")
    await page.getByRole("button", { name: "Quick Add" }).click()
    await expect(page.getByRole("textbox", { name: "Calories" })).toBeVisible()
    await page.getByRole("textbox", { name: "Calories" }).fill("180")
    await page.getByRole("button", { name: "Add to diary" }).click()

    // Expand the dinner section to reveal the entry, then verify the row.
    await page.getByRole("button", { name: /^Dinner, / }).click()
    await expect(page.getByText("Quick add", { exact: true })).toBeVisible({
      timeout: 15_000,
    })
    const row = page.getByRole("button", { name: /^Quick add, / })
    await expect(row).toHaveCount(1)

    // Reject first. Nothing should change. The visible delete button is the
    // one users have; the former hidden long-press path was removed.
    const deleteButton = page.getByRole("button", { name: "Delete Quick add" })
    page.once("dialog", (dialog) => void dialog.dismiss())
    await deleteButton.click()
    await expect(row).toBeVisible()

    // Accept. The entry disappears.
    page.once("dialog", (dialog) => void dialog.accept())
    await deleteButton.click()
    await expect(row).toHaveCount(0, { timeout: 15_000 })
  })

  test("date navigation: next day works and the calendar jumps back to today", async ({ page }) => {
    await bootAuthenticated(page)
    const dateHeader = page.getByRole("button", { name: "Open calendar" })
    await expect(dateHeader.getByText(/^Today/)).toBeVisible()

    await page.getByRole("button", { name: "Next day" }).click()
    await expect(dateHeader.getByText(/^Today/)).toBeHidden()

    // Open the calendar and jump back.
    await page.getByRole("button", { name: "Open calendar" }).click()
    const todayButton = page.getByRole("button", { name: "Go to today" })
    await expect(todayButton).toBeVisible()
    await todayButton.click()
    await expect(
      page.getByRole("button", { name: "Open calendar" }).getByText(/^Today/),
    ).toBeVisible()
  })

  test("meals and calories can be recorded for tomorrow, not today", async ({ page }) => {
    await bootAuthenticated(page)

    // Go to tomorrow.
    await page.getByRole("button", { name: "Next day" }).click()

    // Record a meal there (Quick Add path, fully offline).
    await page.getByRole("button", { name: "Add food to Snacks" }).click()
    await page.getByRole("button", { name: "More" }).click()
    await page.getByRole("button", { name: "Quick Add" }).click()
    await page.getByRole("textbox", { name: "Calories" }).fill("250")
    await page.getByRole("button", { name: "Add to diary" }).click()

    // The entry appears on tomorrow's dashboard (and the ring reflects 250 kcal).
    await page.getByRole("button", { name: /^Snacks, / }).click()
    await expect(page.getByText("Quick add", { exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText("250", { exact: true }).first()).toBeVisible()

    // Today stays empty.
    await page.getByRole("button", { name: "Open calendar" }).click()
    await page.getByRole("button", { name: "Go to today" }).click()
    await expect(page.getByText("Quick add", { exact: true })).toBeHidden()
  })
})
