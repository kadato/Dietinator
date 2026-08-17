import { chromium } from "@playwright/test"
import { spawn } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"

// 8089 is inside the Hyper-V excluded range (8081-8180) on Windows dev
// machines (same issue documented for the 9082 dev port), which makes
// serve-dist.mjs fail with EACCES. Use 9089.
const PORT = 9089
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

      // 1. DASHBOARD (DEMO SESSION)
      console.log(`Capturing dashboard-${scheme}...`)
      await page.goto(`${BASE_URL}/?demo=1`)
      await page.getByRole("button", { name: "Open calendar" }).waitFor({ timeout: 30000 })
      await page.waitForTimeout(1500)
      await page.screenshot({ path: join(OUT_DIR, `dashboard-${scheme}.png`) })

      // 2. STATS & TRENDS
      console.log(`Capturing stats-${scheme}...`)
      await page.getByRole("tab", { name: "Stats" }).click()
      await page.getByText("Consistency", { exact: false }).waitFor({ timeout: 15000 })
      await page.getByText("Body weight", { exact: false }).waitFor({ timeout: 15000 })
      await page.waitForTimeout(1500)
      await page.screenshot({ path: join(OUT_DIR, `stats-${scheme}.png`) })

      // 3. AI CHAT
      console.log(`Capturing ai-chat-${scheme}...`)
      await page.getByRole("tab", { name: "AI Assistant" }).click()
      await page.getByText("Dietinator AI", { exact: false }).waitFor({ timeout: 15000 })
      await page.waitForTimeout(1000)
      await page.screenshot({ path: join(OUT_DIR, `ai-chat-${scheme}.png`) })

      // 4. FOOD SEARCH & FAVORITES
      console.log(`Capturing search-${scheme}...`)
      await page.goto(`${BASE_URL}/log-meal?meal=dinner`)
      await page.getByPlaceholder(/Search/i).waitFor({ timeout: 15000 })
      await page.waitForTimeout(1200)
      await page.screenshot({ path: join(OUT_DIR, `search-${scheme}.png`) })

      // 5. ADD FOOD MODAL
      console.log(`Capturing add-food-${scheme}...`)
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
      await page.waitForTimeout(1200)
      await page.screenshot({ path: join(OUT_DIR, `add-food-${scheme}.png`) })

      // Dismiss modal
      const cancelBtn = page.getByRole("button", { name: "Cancel" }).first()
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click()
      } else {
        await page.keyboard.press("Escape")
      }
      await page.waitForTimeout(500)

      // 6. MEAL BUILDER MODAL
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
      const cancelMb = page.getByRole("button", { name: "Cancel" }).first()
      if (await cancelMb.isVisible()) {
        await cancelMb.click()
      } else {
        await page.keyboard.press("Escape")
      }
      await page.waitForTimeout(500)

      // 7. LOG MEAL SCREEN
      console.log(`Capturing log-meal-${scheme}...`)
      await page.goto(`${BASE_URL}/log-meal?meal=lunch`)
      await page.getByText("Logged in Lunch", { exact: false }).waitFor({ timeout: 15000 })
      await page.waitForTimeout(1200)
      await page.screenshot({ path: join(OUT_DIR, `log-meal-${scheme}.png`) })

      // 8. SETTINGS SCREEN (Goals & Nutrition drilldown)
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
    console.log("\nAll 16 screenshots generated successfully!\n")
  } finally {
    server.kill("SIGTERM")
  }
}

captureAll().catch((err) => {
  console.error("Screenshot capture failed:", err)
  server.kill("SIGTERM")
  process.exit(1)
})
