import { expect, test, bootAuthenticated } from "./helpers"

test.describe("AI assistant + FABs (offline)", () => {
  test("AI nav tab appears when enabled in Settings", async ({ page }) => {
    await bootAuthenticated(page)

    // The AI tab is hidden until the assistant is enabled in Settings.
    await expect(page.getByRole("tab", { name: "AI" })).toBeHidden()

    await page.getByRole("tab", { name: /Settings/ }).click()
    await page.getByRole("button", { name: "AI Assistant settings" }).click()
    await page.getByRole("switch", { name: "Enable AI assistant" }).click()

    // Now the AI tab is visible in navigation.
    await expect(page.getByRole("tab", { name: "AI" })).toBeVisible()

    await page.getByRole("tab", { name: "AI" }).click()
    await expect(page.getByText("Dietinator AI", { exact: true })).toBeVisible()
    await expect(page.getByText("Your nutrition assistant", { exact: true })).toBeVisible()

    // Assistant is enabled → the chat is ready with suggestion chips.
    await expect(page.getByText("How can I help you eat well?")).toBeVisible()
    await expect(page.getByRole("button", { name: "Preset: Daily review" })).toBeVisible()

    // Chat input is present.
    await expect(page.getByLabel("Message the AI assistant")).toBeVisible()

    // Navigate back to Today tab.
    await page.getByRole("tab", { name: /Today/ }).click()
    await expect(page.getByRole("button", { name: "Open calendar" })).toBeVisible()
  })

  test("Settings exposes the AI assistant section and the MCP agent info", async ({ page }) => {
    await bootAuthenticated(page)

    await page.getByRole("tab", { name: /Settings/ }).click()

    // AI settings live on the AI tab.
    await page.getByRole("button", { name: "AI Assistant settings" }).click()
    await expect(page.getByText("AI Assistant", { exact: true }).first()).toBeVisible()

    // Toggle the assistant on.
    await page.getByRole("switch", { name: "Enable AI assistant" }).click()
    await expect(page.getByPlaceholder("https://api.openai.com/v1")).toBeVisible()

    // Agent API section lists the MCP tools on the About section (expand the row first).
    await page.getByRole("button", { name: "Back to all settings" }).click()
    await page.getByRole("button", { name: "About & Account settings" }).click()
    await expect(page.getByText("Agent API (MCP)", { exact: true }).first()).toBeVisible()
    await page.getByRole("button", { name: "Show Agent API details" }).click()
    await expect(page.getByText("get_diary", { exact: true })).toBeVisible()
    await expect(page.getByText("log_food", { exact: true })).toBeVisible()

    // Turn it back off to leave a clean state for other specs.
    await page.getByRole("button", { name: "Back to all settings" }).click()
    await page.getByRole("button", { name: "AI Assistant settings" }).click()
    await page.getByRole("switch", { name: "Enable AI assistant" }).click()
  })

  test("barcode scanning is available in food tracking", async ({ page }) => {
    await bootAuthenticated(page)

    // No direct scanner shortcut on the dashboard anymore.
    await expect(page.getByRole("button", { name: "Scan barcode" })).toBeHidden()

    // Food tracking (log-meal) has the Scan mode.
    await page.getByRole("button", { name: "Add food to Lunch" }).click()
    await expect(page.getByRole("button", { name: "Scan" })).toBeVisible()
    await page.getByRole("button", { name: "Cancel" }).click()
  })
})
