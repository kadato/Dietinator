import { expect, test, bootAuthenticated } from "./helpers"

test.describe("stats: weight and calorie trends (offline, local-first)", () => {
  test("log a weight, see it charted, switch ranges, then delete it", async ({ page }) => {
    await bootAuthenticated(page)

    await page.getByRole("tab", { name: "Stats" }).click()

    // Empty state for weight.
    await expect(page.getByText("Body weight", { exact: true })).toBeVisible()
    await expect(page.getByText("Not logged yet")).toBeVisible()

    // Log a weight for today.
    await page.getByRole("button", { name: "Log weight" }).first().click()
    await expect(page.getByRole("textbox", { name: "Weight" })).toBeVisible()
    await page.getByRole("textbox", { name: "Weight" }).fill("75.5")
    await page.getByRole("button", { name: "Save weight" }).click()

    // Back on Stats. The header shows the latest entry and the chart is drawn.
    await expect(page.getByText("75.5 kg", { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByLabel(/Body weight trend/)).toBeVisible()

    // The calorie card renders its empty state (no diary entries seeded).
    await expect(page.getByText("No diary entries in this range yet.")).toBeVisible()

    // Changing the range keeps the data (the default range is 1M, so try 1Y).
    await page.getByRole("button", { name: "1Y" }).click()
    await expect(page.getByText("75.5 kg", { exact: true }).first()).toBeVisible()
    await expect(page.getByLabel(/Body weight trend/)).toBeVisible()

    // Delete the latest entry to leave a clean state for other specs.
    page.once("dialog", (dialog) => void dialog.accept())
    await page.getByRole("button", { name: "Delete latest weight" }).click()
    await expect(page.getByText("Not logged yet")).toBeVisible()
  })

  test("log weight modal validates input", async ({ page }) => {
    await bootAuthenticated(page)

    await page.getByRole("tab", { name: "Stats" }).click()
    await page.getByRole("button", { name: "Log weight" }).first().click()
    const weightInput = page.getByRole("textbox", { name: "Weight" })
    await expect(weightInput).toBeVisible()

    // Empty input must not save.
    await page.getByRole("button", { name: "Save weight" }).click()
    await expect(weightInput).toBeVisible()

    await weightInput.fill("not-a-number")
    await page.getByRole("button", { name: "Save weight" }).click()
    await expect(weightInput).toBeVisible()

    // Cancel leaves no entry behind.
    await page.getByRole("button", { name: "Cancel" }).click()
    await expect(page.getByText("Not logged yet")).toBeVisible()
  })
})
