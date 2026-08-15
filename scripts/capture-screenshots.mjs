import { chromium } from "@playwright/test"
import { spawn } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"

const PORT = 8089
const BASE_URL = `http://localhost:${PORT}`
const OUT_DIR = join(process.cwd(), "docs", "screenshots")

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true })
}

// Start serve-dist server
const server = spawn("node", ["scripts/serve-dist.mjs"], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: "inherit",
})

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(BASE_URL)
      if (res.ok) return
    } catch {
      await wait(250)
    }
  }
  throw new Error("Server failed to start")
}

async function captureAll() {
  try {
    await waitForServer()
    console.log("Server ready on port", PORT)

    const browser = await chromium.launch({ headless: true })

    for (const scheme of ["light", "dark"]) {
      console.log(`\n=== Capturing ${scheme.toUpperCase()} screenshots ===\n`)

      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        colorScheme: scheme,
      })

      const page = await context.newPage()

      // 1. LOGIN SCREEN (clear auth)
      console.log(`Capturing login-${scheme}...`)
      await page.goto(`${BASE_URL}/login`)
      await page.evaluate(() => localStorage.clear())
      await page.goto(`${BASE_URL}/login`)
      await page.waitForTimeout(1000)
      await page.screenshot({ path: join(OUT_DIR, `login-${scheme}.png`) })

      // 2. DASHBOARD (DEMO SESSION)
      console.log(`Capturing dashboard-${scheme}...`)
      await page.goto(`${BASE_URL}/?demo=1`)
      await page.getByRole("button", { name: "Open calendar" }).waitFor({ timeout: 30000 })
      await page.waitForTimeout(1500)
      await page.screenshot({ path: join(OUT_DIR, `dashboard-${scheme}.png`) })

      // 3. AI CHAT
      console.log(`Capturing ai-chat-${scheme}...`)
      // Enable AI assistant in Settings first
      await page.getByRole("tab", { name: /Settings/ }).click()
      await page.waitForTimeout(500)
      const aiSectionBtn = page.getByRole("button", { name: /AI Assistant/i }).first()
      await aiSectionBtn.waitFor({ timeout: 15000 })
      await aiSectionBtn.click()
      await page.waitForTimeout(500)

      const aiSwitch = page.getByRole("switch", { name: "Enable AI assistant" })
      if (await aiSwitch.isVisible()) {
        const isChecked = await aiSwitch.getAttribute("aria-checked")
        if (isChecked !== "true") {
          await aiSwitch.click()
          await page.waitForTimeout(500)
        }
      }

      // Go back to Today tab and open AI assistant
      await page.getByRole("tab", { name: /Today/ }).click()
      await page.waitForTimeout(500)
      const aiFab = page.getByRole("button", { name: "Open AI assistant" })
      await aiFab.waitFor({ timeout: 10000 })
      await aiFab.click()
      await page.getByText("Dietinator AI", { exact: true }).waitFor({ timeout: 10000 })
      await page.waitForTimeout(1000)
      await page.screenshot({ path: join(OUT_DIR, `ai-chat-${scheme}.png`) })

      // Close AI chat modal
      const closeAi = page.getByRole("button", { name: "Close AI chat" }).first()
      if (await closeAi.isVisible()) {
        await closeAi.click()
      } else {
        await page.keyboard.press("Escape")
      }
      await page.waitForTimeout(500)

      // 4. SEARCH TAB
      console.log(`Capturing search-${scheme}...`)
      await page.getByRole("tab", { name: "Search" }).click()
      await page.getByPlaceholder("e.g. banana, oats, chicken").waitFor({ timeout: 15000 })
      await page.waitForTimeout(1000)
      await page.screenshot({ path: join(OUT_DIR, `search-${scheme}.png`) })

      // 5. ADD FOOD MODAL
      console.log(`Capturing add-food-${scheme}...`)
      // Click on Banana or Oatmeal in the search list
      const bananaItem = page.getByText("Banana").first()
      const oatmealItem = page.getByText("Oatmeal, cooked").first()
      if (await bananaItem.isVisible()) {
        await bananaItem.click()
      } else if (await oatmealItem.isVisible()) {
        await oatmealItem.click()
      } else {
        await page.locator('[aria-label*="calories"]').first().click()
      }
      await page.getByRole("button", { name: "Add to diary" }).waitFor({ timeout: 15000 })
      await page.waitForTimeout(1000)
      await page.screenshot({ path: join(OUT_DIR, `add-food-${scheme}.png`) })

      // Dismiss modal
      await page.getByRole("button", { name: "Cancel" }).first().click()
      await page.waitForTimeout(500)

      // 6. QUICK ADD MODAL
      console.log(`Capturing quick-add-${scheme}...`)
      await page.goto(`${BASE_URL}/create-options?meal_type=snack`)
      await page.waitForTimeout(600)
      await page.getByRole("button", { name: "Quick Add" }).first().click()
      await page.getByLabel("Calories").waitFor({ timeout: 15000 })
      await page.getByLabel("Calories").fill("350")
      await page.getByLabel("Protein (g)").fill("20")
      await page.getByLabel("Carbs (g)").fill("45")
      await page.getByLabel("Fat (g)").fill("10")
      await page.evaluate(() => document.activeElement?.blur?.())
      await page.waitForTimeout(800)
      await page.screenshot({ path: join(OUT_DIR, `quick-add-${scheme}.png`) })

      // Dismiss
      await page.getByRole("button", { name: "Cancel" }).first().click()
      await page.waitForTimeout(500)

      // 7. MEAL BUILDER MODAL
      console.log(`Capturing meal-builder-${scheme}...`)
      await page.goto(`${BASE_URL}/meal-builder`)
      await page.getByLabel("Meal name").waitFor({ timeout: 15000 })
      await page.getByLabel("Meal name").fill("Morning Power Bowl")
      await page.evaluate(() => document.activeElement?.blur?.())
      // Add items from favorites/recents if available
      const addOats = page.locator('[role="button"][aria-label*="Oatmeal"]').first()
      if (await addOats.isVisible()) {
        await addOats.click()
        await page.waitForTimeout(300)
      }
      const addBanana = page.locator('[role="button"][aria-label*="Banana"]').first()
      if (await addBanana.isVisible()) {
        await addBanana.click()
        await page.waitForTimeout(300)
      }
      // Scroll to top
      await page.evaluate(() => {
        const scrollable = document.querySelector('div[class*="r-150rngu"]')
        if (scrollable) scrollable.scrollTop = 0
        window.scrollTo(0, 0)
      })
      await page.waitForTimeout(800)
      await page.screenshot({ path: join(OUT_DIR, `meal-builder-${scheme}.png`) })

      // Dismiss
      await page.getByRole("button", { name: "Cancel" }).first().click()
      await page.waitForTimeout(500)

      // 8. LOG MEAL SCREEN
      console.log(`Capturing log-meal-${scheme}...`)
      await page.goto(`${BASE_URL}/log-meal?meal_type=breakfast`)
      await page.waitForTimeout(1000)
      await page.screenshot({ path: join(OUT_DIR, `log-meal-${scheme}.png`) })

      // 9. SETTINGS SCREEN (Goals & Nutrition drilldown)
      console.log(`Capturing settings-${scheme}...`)
      await page.goto(`${BASE_URL}/(tabs)/settings`)
      await page.waitForTimeout(500)
      const goalsSection = page.getByRole("button", { name: /Goals/i }).first()
      await goalsSection.waitFor({ timeout: 15000 })
      await goalsSection.click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: join(OUT_DIR, `settings-${scheme}.png`) })

      await context.close()
    }

    await browser.close()
    console.log("\nAll 18 screenshots generated successfully!\n")
  } finally {
    server.kill("SIGTERM")
  }
}

captureAll().catch((err) => {
  console.error("Screenshot capture failed:", err)
  server.kill("SIGTERM")
  process.exit(1)
})
