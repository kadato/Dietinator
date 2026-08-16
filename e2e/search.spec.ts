import { expect, test, bootAuthenticated } from "./helpers"

test.describe("food search (offline)", () => {
  test("food search renders cached-first and shows the offline banner", async ({ page }) => {
    await bootAuthenticated(page)

    await page.getByRole("button", { name: "Add food to Breakfast" }).click()
    await expect(page.getByPlaceholder("Search foods…")).toBeVisible()
    await expect(page.getByRole("button", { name: "Favorites" })).toBeVisible()

    await page.getByPlaceholder("Search foods…").click()
    await expect(page.getByPlaceholder("Search foods…")).toBeFocused()
    await page.getByPlaceholder("Search foods…").fill("oats")
    // No YAZIO in tests → remote fails, offline banner appears, cached list stays usable.
    await expect(page.getByText(/YAZIO unavailable/i).first()).toBeVisible({
      timeout: 20_000,
    })
  })

  test("log-meal modal opens from the dashboard and can close", async ({ page }) => {
    await bootAuthenticated(page)

    await page.getByRole("button", { name: "Add food to Breakfast" }).click()
    // The modal title (the dashboard card behind it also says "Breakfast" — scope to the modal).
    await expect(page.getByRole("button", { name: "More" })).toBeVisible()
    await expect(page.getByPlaceholder("Search foods…")).toBeVisible()

    // The log-meal modal closes via its bottom-left cancel FAB.
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible()
    await page.getByRole("button", { name: "Cancel" }).click()
    await expect(page.getByRole("button", { name: "Open calendar" })).toBeVisible()
  })

  test("settings screen sections group goals, sync, and about", async ({ page }) => {
    await bootAuthenticated(page)

    await page.getByRole("tab", { name: "Settings" }).click()

    // The hub lists sections; the Goals row opens the goal form.
    await page.getByRole("button", { name: "Goals & Nutrition settings" }).click()
    await expect(page.getByText("Goals & Nutrition", { exact: true })).toBeVisible()
    await expect(page.getByText("Calories", { exact: true })).toBeVisible()

    // Sync section.
    await page.getByRole("button", { name: "Back to all settings" }).click()
    await page.getByRole("button", { name: "YAZIO Sync settings" }).click()
    // The drilldown header and the section label both read "YAZIO Sync".
    await expect(page.getByText("YAZIO Sync", { exact: true }).first()).toBeVisible()

    // About section hosts the sign-out button.
    await page.getByRole("button", { name: "Back to all settings" }).click()
    await page.getByRole("button", { name: "About & Account settings" }).click()
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible()
  })
})
