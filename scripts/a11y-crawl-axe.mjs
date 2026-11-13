#!/usr/bin/env node
import { spawn } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { chromium } from "@playwright/test"

const PORT = Number(process.env.PORT ?? 8082)
const BASE = `http://localhost:${PORT}`
const AXE_SRC = readFileSync("node_modules/axe-core/axe.min.js", "utf8")

async function ensureServer() {
  try {
    const r = await fetch(BASE + "/", { signal: AbortSignal.timeout(2000) })
    if (r.ok) return null
  } catch {}
  const child = spawn("node", ["scripts/serve-dist.mjs"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "pipe",
  })
  child.stdout.on("data", (d) => process.stdout.write(`[serve] ${d}`))
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    try {
      const r = await fetch(BASE + "/", { signal: AbortSignal.timeout(2000) })
      if (r.ok) return child
    } catch {}
  }
  child.kill()
  throw new Error("no server")
}

const ROUTES = [
  { path: "/login", auth: false, name: "login" },
  { path: "/", auth: true, name: "today" },
  { path: "/stats", auth: true, name: "stats" },
  { path: "/settings", auth: true, name: "settings" },
  { path: "/privacy", auth: true, name: "privacy" },
]

async function axeAudit(page) {
  await page.addScriptTag({ content: AXE_SRC })
  return page.evaluate(async () => {
    // @ts-ignore
    const res = await window.axe.run(document, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      // Dev-only Expo error toast, never shipped in production builds.
      exclude: [["#error-toast"], [".D_OwSW_toast"]],
    })
    return res.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => ({
        target: n.target.join(", "),
        html: n.html.slice(0, 300),
        failure: n.failureSummary?.slice(0, 300),
      })),
      count: v.nodes.length,
    }))
  })
}

async function layoutAudit(page) {
  return page.evaluate(() => {
    const out = []
    const visible = (el) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return false
      // Offscreen skip-link and hidden shell. Ignore them in layout checks
      if (r.right < 0 || r.bottom < 0) return false
      if (r.left > window.innerWidth || r.top > window.innerHeight) return false
      const cs = getComputedStyle(el)
      if (cs.display === "none" || cs.visibility === "hidden") return false
      return true
    }
    if (document.documentElement.scrollWidth > window.innerWidth + 1)
      out.push({
        rule: "horizontal-overflow",
        detail: `scrollWidth ${document.documentElement.scrollWidth} > ${window.innerWidth}`,
      })
    document.querySelectorAll('button, a[href], [role="button"], [role="tab"]').forEach((el) => {
      if (!visible(el)) return
      if (el.classList.contains("skip-link")) return // The link stays visually hidden until focus. It is exempt from the check
      const r = el.getBoundingClientRect()
      if (r.height > 0 && r.height < 24)
        out.push({
          rule: "target-size",
          detail: `${Math.round(r.width)}x${Math.round(r.height)} "${(el.innerText || "").slice(0, 40)}" :: ${(el.outerHTML || "").slice(0, 160)}`,
        })
    })
    return out
  })
}

async function main() {
  const server = await ensureServer()
  const browser = await chromium.launch({ headless: true })
  const all = {}
  for (const theme of ["light", "dark"]) {
    for (const vp of [
      { w: 390, h: 844, label: "phone" },
      { w: 1280, h: 800, label: "desktop" },
    ]) {
      for (const r of ROUTES) {
        const ctx = await browser.newContext({
          viewport: { width: vp.w, height: vp.h },
          colorScheme: theme,
        })
        if (r.auth) {
          await ctx.addInitScript(() => {
            localStorage.setItem("calorie_tracker_yazio_logged_in", "1")
          })
        }
        const page = await ctx.newPage()
        const key = `${r.name}@${vp.label}@${theme}`
        try {
          await page.goto(BASE + r.path, { waitUntil: "networkidle", timeout: 30000 })
          await page.waitForTimeout(2500)
          const resolvedTheme = await page.evaluate(() => ({
            darkClass: document.documentElement.classList.contains("dark"),
            colorScheme: getComputedStyle(document.documentElement).colorScheme,
            bg: getComputedStyle(document.body).backgroundColor,
          }))
          const axe = await axeAudit(page)
          const layout = await layoutAudit(page)
          all[key] = { url: r.path, theme, viewport: vp.label, resolvedTheme, axe, layout }
          console.log(
            `[${key}] resolved=${JSON.stringify(resolvedTheme)} axe=${axe.length} layout=${layout.length}`,
          )
          axe.forEach((v) => console.log(`  AXE ${v.id}(${v.impact}) x${v.count}: ${v.help}`))
          layout.forEach((v) => console.log(`  LAYOUT ${v.rule}: ${v.detail.slice(0, 140)}`))
        } catch (e) {
          console.log(`[${key}] ERROR ${e}`)
          all[key] = { error: String(e) }
        }
        await ctx.close()
      }

      // interactive modal crawl on phone only once per theme
      if (vp.label === "phone") {
        const flows = [
          {
            name: "log-meal-modal",
            open: async (page) => {
              await page.getByRole("button", { name: "Add food to Snacks" }).click()
            },
          },
          {
            name: "quick-add-modal",
            open: async (page) => {
              await page.getByRole("button", { name: "Add food to Snacks" }).click()
              await page.getByRole("button", { name: "More options" }).click()
              await page.getByRole("button", { name: "Quick Add" }).click()
            },
          },
        ]
        for (const f of flows) {
          const fctx = await browser.newContext({
            viewport: { width: vp.w, height: vp.h },
            colorScheme: theme,
          })
          await fctx.addInitScript(() => {
            localStorage.setItem("calorie_tracker_yazio_logged_in", "1")
          })
          const fpage = await fctx.newPage()
          try {
            await fpage.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 })
            await fpage.waitForTimeout(2500)
            await f.open(fpage)
            await fpage.waitForTimeout(1200)
            const resolvedTheme = await fpage.evaluate(() => ({
              darkClass: document.documentElement.classList.contains("dark"),
              colorScheme: getComputedStyle(document.documentElement).colorScheme,
            }))
            const axe = await axeAudit(fpage)
            const layout = await layoutAudit(fpage)
            all[`${f.name}@${vp.label}@${theme}`] = {
              url: "interactive:" + f.name,
              theme,
              resolvedTheme,
              axe,
              layout,
            }
            console.log(
              `[${f.name}@${theme}] resolved=${JSON.stringify(resolvedTheme)} axe=${axe.length} layout=${layout.length}`,
            )
            axe.forEach((v) => console.log(`  AXE ${v.id} x${v.count}: ${v.help}`))
            layout.forEach((v) => console.log(`  LAYOUT ${v.rule}: ${v.detail.slice(0, 140)}`))
          } catch (e) {
            console.log(`[${f.name}@${theme}] ERROR ${String(e).slice(0, 300)}`)
            all[`${f.name}@${vp.label}@${theme}`] = {
              url: "interactive:" + f.name,
              theme,
              error: String(e).slice(0, 300),
            }
          }
          await fctx.close()
        }

        // Food lists and add-food modals need seeded data. Use one demo context
        // per theme, seeded once, then a fresh page per flow.
        const dctx = await browser.newContext({
          viewport: { width: vp.w, height: vp.h },
          colorScheme: theme,
        })
        try {
          const seed = await dctx.newPage()
          await seed.goto(BASE + "/?demo=1", { waitUntil: "networkidle", timeout: 30000 })
          await seed
            .getByRole("button", { name: "Open calendar" })
            .first()
            .waitFor({ timeout: 30000 })
          await seed.waitForTimeout(1500)
          await seed.close()

          const foodFlows = [
            {
              name: "log-meal-favorites",
              open: async (page) => {
                await page.getByRole("button", { name: "Add food to Snacks" }).click()
                await page.getByRole("tab", { name: "Favorites" }).click()
              },
            },
            {
              name: "log-meal-search",
              open: async (page) => {
                await page.getByRole("button", { name: "Add food to Snacks" }).click()
                await page.getByRole("button", { name: "Search foods" }).click()
                await page.getByPlaceholder("Search foods…").fill("oat")
              },
            },
            {
              name: "add-food-detail",
              open: async (page) => {
                await page.getByRole("button", { name: "Add food to Snacks" }).click()
                await page.getByRole("button", { name: "Search foods" }).click()
                await page.getByPlaceholder("Search foods…").fill("oat")
                await page.getByRole("button", { name: /oat/i }).first().click()
                await page
                  .getByRole("button", { name: /Add .* to diary/ })
                  .waitFor({ timeout: 15000 })
              },
            },
            {
              name: "create-options-menu",
              open: async (page) => {
                await page.getByRole("button", { name: "Add food to Snacks" }).click()
                await page.getByRole("button", { name: "More options" }).click()
                await page
                  .getByText("What would you like to log or create?")
                  .waitFor({ timeout: 15000 })
              },
            },
            {
              name: "manual-entry",
              open: async (page) => {
                await page.getByRole("button", { name: "Add food to Snacks" }).click()
                await page.getByRole("button", { name: "More options" }).click()
                await page.getByRole("button", { name: "New food" }).click()
                await page.getByText("New Food", { exact: true }).waitFor({ timeout: 15000 })
              },
            },
            {
              name: "meal-builder",
              open: async (page) => {
                await page.getByRole("button", { name: "Add food to Snacks" }).click()
                await page.getByRole("button", { name: "More options" }).click()
                await page.getByRole("button", { name: "New meal" }).click()
                await page.getByLabel("Meal name").waitFor({ timeout: 15000 })
              },
            },
            {
              name: "scan",
              open: async (page) => {
                await page.getByRole("button", { name: "Add food to Snacks" }).click()
                await page.getByRole("button", { name: "Scan barcode" }).click()
              },
            },
          ]
          for (const f of foodFlows) {
            const fpage = await dctx.newPage()
            try {
              await fpage.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 })
              await fpage.waitForTimeout(2000)
              await f.open(fpage)
              await fpage.waitForTimeout(1200)
              const resolvedTheme = await fpage.evaluate(() => ({
                darkClass: document.documentElement.classList.contains("dark"),
                colorScheme: getComputedStyle(document.documentElement).colorScheme,
              }))
              const axe = await axeAudit(fpage)
              const layout = await layoutAudit(fpage)
              all[`${f.name}@${vp.label}@${theme}`] = {
                url: "interactive:" + f.name,
                theme,
                resolvedTheme,
                axe,
                layout,
              }
              console.log(
                `[${f.name}@${theme}] resolved=${JSON.stringify(resolvedTheme)} axe=${axe.length} layout=${layout.length}`,
              )
              axe.forEach((v) => console.log(`  AXE ${v.id} x${v.count}: ${v.help}`))
              layout.forEach((v) => console.log(`  LAYOUT ${v.rule}: ${v.detail.slice(0, 140)}`))
            } catch (e) {
              console.log(`[${f.name}@${theme}] ERROR ${String(e).slice(0, 300)}`)
              all[`${f.name}@${vp.label}@${theme}`] = {
                url: "interactive:" + f.name,
                theme,
                error: String(e).slice(0, 300),
              }
            }
            await fpage.close()
          }
        } finally {
          await dctx.close()
        }
      }
    }
  }
  await browser.close()
  if (server) server.kill()
  writeFileSync("a11y-baseline.json", JSON.stringify(all, null, 2))
  console.log("wrote a11y-baseline.json")
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
