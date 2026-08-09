import { expect, test, bootAuthenticated } from "./helpers"

test.describe("food search (offline)", () => {
  test("search tab renders cached-first and shows the offline banner", async ({ page }) => {
    await bootAuthenticated(page)

    await page.getByText("Search", { exact: true }).click()
    await expect(page.getByPlaceholder("e.g. banana, oats, chicken")).toBeVisible()
    await expect(page.getByText("Favorites", { exact: true })).toBeVisible()

    // The search FAB focuses the search box.
    await page.getByRole("button", { name: "Focus search" }).click()
    await expect(page.getByPlaceholder("e.g. banana, oats, chicken")).toBeFocused()
    await page.getByPlaceholder("e.g. banana, oats, chicken").fill("oats")
    // Recents/Favorites must stay visible while searching.
    await expect(page.getByText("Recents", { exact: true })).toBeVisible()
    // No YAZIO in tests → remote fails, offline banner appears, cached list stays usable.
    // (Both the dashboard and this tab may show the banner — assert the first.)
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

    await page.getByRole("button", { name: "Done" }).click()
    await expect(page.getByRole("button", { name: "Open calendar" })).toBeVisible()
  })

  test("settings screen tabs group goals, sync, and about sections", async ({ page }) => {
    await bootAuthenticated(page)

    await page.getByText("Settings", { exact: true }).click()

    // Goals tab is the default.
    await expect(page.getByText("Daily goals", { exact: true })).toBeVisible()
    await expect(page.getByText("Calories (kcal)")).toBeVisible()

    // Sync tab.
    await page.getByRole("button", { name: "Sync settings" }).click()
    await expect(page.getByText("YAZIO sync", { exact: true })).toBeVisible()

    // About tab hosts the sign-out button.
    await page.getByRole("button", { name: "About settings" }).click()
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible()
  })
})
