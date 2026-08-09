import { expect, test, bootAuthenticated } from "./helpers"

test.describe("AI assistant + FABs (offline)", () => {
  test("Today shows the FAB cluster and opens the AI chat modal", async ({ page }) => {
    await bootAuthenticated(page)

    // Phone viewport: the AI FAB is hidden until the assistant is enabled
    // in Settings.
    await expect(page.getByRole("button", { name: "Open AI assistant" })).toBeHidden()

    await page.getByRole("tab", { name: /Settings/ }).click()
    await page.getByRole("button", { name: "AI settings" }).click()
    await page.getByRole("switch", { name: "Enable AI assistant" }).click()
    await page.getByRole("tab", { name: /Today/ }).click()
    await expect(page.getByRole("button", { name: "Open AI assistant" })).toBeVisible()

    await page.getByRole("button", { name: "Open AI assistant" }).click()
    await expect(page.getByText("Dietinator AI", { exact: true })).toBeVisible()
    await expect(page.getByText("Your nutrition assistant", { exact: true })).toBeVisible()

    // Assistant is enabled → the chat is ready with suggestion chips.
    await expect(page.getByText("How can I help you eat well?")).toBeVisible()
    await expect(page.getByRole("button", { name: "Preset: Daily review" })).toBeVisible()

    // Chat input is present but gated on configuration.
    await expect(page.getByLabel("Message the AI assistant")).toBeVisible()

    await page.getByRole("button", { name: "Close AI chat" }).click()
    await expect(page.getByText("Dietinator AI", { exact: true })).toBeHidden()
  })

  test("Settings exposes the AI assistant section and the MCP agent info", async ({ page }) => {
    await bootAuthenticated(page)

    await page.getByRole("tab", { name: /Settings/ }).click()

    // AI settings live on the AI tab.
    await page.getByRole("button", { name: "AI settings" }).click()
    await expect(page.getByText("AI assistant", { exact: true }).first()).toBeVisible()

    // Toggle the assistant on.
    await page.getByRole("switch", { name: "Enable AI assistant" }).click()
    await expect(page.getByPlaceholder("https://api.openai.com/v1")).toBeVisible()

    // Agent API section lists the MCP tools on the About tab (expand the row first).
    await page.getByRole("button", { name: "About settings" }).click()
    await expect(page.getByText("Agent API (MCP)", { exact: true }).first()).toBeVisible()
    await page.getByRole("button", { name: "Show Agent API details" }).click()
    await expect(page.getByText("get_diary", { exact: true })).toBeVisible()
    await expect(page.getByText("log_food", { exact: true })).toBeVisible()

    // Turn it back off to leave a clean state for other specs.
    await page.getByRole("button", { name: "AI settings" }).click()
    await page.getByRole("switch", { name: "Enable AI assistant" }).click()
  })

  test("barcode scanning lives inside food tracking only", async ({ page }) => {
    await bootAuthenticated(page)

    // No direct scanner shortcut on the dashboard anymore.
    await expect(page.getByRole("button", { name: "Scan barcode" })).toBeHidden()

    // Food tracking (log-meal) has the Scan mode.
    await page.getByRole("button", { name: "Add food to Lunch" }).click()
    await expect(page.getByRole("button", { name: "Scan" })).toBeVisible()
    await page.getByRole("button", { name: "Cancel" }).click()

    // The Search tab carries no duplicate scanner.
    await page.getByText("Search", { exact: true }).click()
    await expect(page.getByText("Search foods", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Scan barcode" })).toBeHidden()
  })
})
