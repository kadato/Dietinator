import { expect, test, bootAuthenticated } from "./helpers"

test.describe("AI assistant + FABs (offline)", () => {
  test("Today shows the FAB cluster and opens the AI chat modal", async ({ page }) => {
    await bootAuthenticated(page)

    // Phone viewport: extended Add food FAB + round AI FAB above the tab bar.
    await expect(page.getByRole("button", { name: "Add food", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Open AI assistant" })).toBeVisible()

    await page.getByRole("button", { name: "Open AI assistant" }).click()
    await expect(page.getByText("Dietinator AI", { exact: true })).toBeVisible()
    await expect(page.getByText("Your nutrition assistant", { exact: true })).toBeVisible()

    // Not configured yet → setup banner with suggestion chips.
    await expect(page.getByText("AI Assistant needs setup", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Open AI settings" })).toBeVisible()
    await expect(page.getByText("How can I help you eat well?")).toBeVisible()

    // Chat input is present but gated on configuration.
    await expect(page.getByLabel("Message the AI assistant")).toBeVisible()

    await page.getByRole("button", { name: "Close AI chat" }).click()
    await expect(page.getByText("Dietinator AI", { exact: true })).toBeHidden()
  })

  test("Settings exposes the AI assistant section and the MCP agent info", async ({ page }) => {
    await bootAuthenticated(page)

    await page.getByRole("tab", { name: /Settings/ }).click()
    await expect(page.getByText("AI assistant", { exact: true }).first()).toBeVisible()

    // Toggle the assistant on.
    await page.getByRole("switch", { name: "Enable AI assistant" }).click()
    await expect(page.getByPlaceholder("https://api.openai.com/v1")).toBeVisible()

    // Agent API section lists the MCP tools on web.
    await expect(page.getByText("Agent API (MCP)", { exact: true })).toBeVisible()
    await expect(page.getByText("get_diary", { exact: true })).toBeVisible()
    await expect(page.getByText("log_food", { exact: true })).toBeVisible()

    // Turn it back off to leave a clean state for other specs.
    await page.getByRole("switch", { name: "Enable AI assistant" }).click()
  })

  test("Search shows the barcode scan FAB on phone viewports", async ({ page }) => {
    await bootAuthenticated(page)

    await page.getByText("Search", { exact: true }).click()
    await expect(page.getByText("Search foods", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Scan barcode" })).toBeVisible()
  })
})
