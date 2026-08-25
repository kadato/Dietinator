#!/usr/bin/env node
/**
 * Lighthouse runner for the Dietinator web build.
 *
 * Audits the authenticated app via the app's own `?demo=1` flow: the
 * COOP/COEP headers that wa-sqlite requires partition localStorage per
 * browsing context group, so a browser profile's login can never be shared
 * into a Lighthouse audit tab. Demo mode is the app's supported, e2e-tested
 * way to reach the real dashboard without credentials.
 *
 * - Auto-detects a Chrome/Chromium binary (CHROME_PATH overrides)
 * - Runs a Lighthouse audit per route in light AND dark color schemes
 *   (dark is driven via CDP Emulation.setEmulatedMedia)
 * - One browser per scheme: warm-up seeds the demo DB once, then every route
 *   is audited in that same profile so OPFS storage stays valid
 * - Saves HTML + JSON reports to lighthouse-reports/ and prints the score table
 *
 * Usage:
 *   npm run build:web
 *   node scripts/lighthouse-run.mjs [dashboard stats ...]   # default: all routes
 *
 * Env:
 *   BASE_URL    (default http://localhost:9082; point at a running
 *               `npm run serve:web` or let this script start one)
 *   PRESET      mobile (default) | desktop
 *   THEME       light | dark | both (default both)
 *   REPORT_DIR  (default lighthouse-reports/)
 */
import { spawn } from "node:child_process"
import { mkdirSync, writeFileSync, existsSync, rmSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir, tmpdir } from "node:os"
import { launch as launchChrome } from "puppeteer-core"
import lighthouse from "lighthouse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const BASE_URL = process.env.BASE_URL ?? "http://localhost:9082"
const PRESET = process.env.PRESET ?? "mobile"
const THEME = process.env.THEME ?? "both"
const OUT_DIR = process.env.REPORT_DIR ?? join(ROOT, "lighthouse-reports")

/** Every page and modal in the app. Demo flag where the DB must be seeded. */
const ROUTES = {
  login: "/login",
  dashboard: "/?demo=1",
  stats: "/stats?demo=1",
  ai: "/ai?demo=1",
  settings: "/settings?demo=1",
  "log-meal": "/log-meal?meal=lunch&demo=1",
  "create-options": "/create-options?meal=lunch&demo=1",
  "manual-entry": "/manual-entry?meal=lunch&demo=1",
  "meal-builder": "/meal-builder?demo=1",
  scan: "/scan?meal=lunch&demo=1",
  "add-food": "/add-food?meal=lunch&demo=1",
}

function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH
  }
  const candidates = []
  // Playwright-managed Chromium first (same binary Playwright MCP uses).
  // Newest version wins: older builds may lack the OPFS features wa-sqlite
  // needs for the demo seed.
  const pwDir = join(homedir(), ".cache", "ms-playwright")
  try {
    const versions = readdirSync(pwDir)
      .filter((entry) => /^chromium-\d+$/.test(entry))
      .map((entry) => Number(entry.split("-")[1]))
      .sort((a, b) => b - a)
    for (const v of versions) {
      for (const sub of ["chrome-linux64/chrome", "chrome-linux/chrome"]) {
        candidates.push(join(pwDir, `chromium-${v}`, sub))
      }
    }
  } catch {
    // No Playwright cache.
  }
  for (const name of ["google-chrome-stable", "google-chrome", "chromium", "chromium-browser"]) {
    const bin = `/usr/bin/${name}`
    const local = `/usr/local/bin/${name}`
    candidates.push(local, bin)
  }
  return candidates.find((p) => existsSync(p)) ?? null
}

const schemes = THEME === "light" ? ["light"] : THEME === "dark" ? ["dark"] : ["light", "dark"]

const requested = process.argv.slice(2).filter((a) => !a.startsWith("--"))
const auditRoutes = requested.length
  ? requested.filter((name) => ROUTES[name])
  : Object.keys(ROUTES)

const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"]

const lighthouseFlags = {
  output: ["html", "json"],
  onlyCategories: CATEGORIES,
  disableStorageReset: true,
  maxWaitForLoad: 90_000,
  logLevel: "error",
  ...(PRESET === "desktop"
    ? {
        formFactor: "desktop",
        screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1 },
        throttling: { rttMs: 40, throughputKbps: 10740, cpuSlowdownMultiplier: 1 },
        throttlingMethod: "simulate",
      }
    : {
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 412,
          height: 823,
          deviceScaleFactor: 1.75,
          disabled: false,
        },
      }),
}

function printTable(results) {
  const header = ["route", "theme", "perf", "a11y", "bp", "seo"]
  const rows = results.map((r) => [
    r.name,
    r.scheme,
    ...CATEGORIES.map((id) => {
      const category = r.categories[id]
      return !category || category.score === null || category.score === undefined
        ? "-"
        : String(Math.round(category.score * 100))
    }),
  ])
  const widths = header.map((_, i) =>
    Math.max(header[i].length, ...rows.map((row) => row[i]?.length ?? 0)),
  )
  console.log(header.map((cell, i) => cell.padEnd(widths[i])).join("  "))
  for (const row of rows) {
    console.log(row.map((cell, i) => (cell ?? "").padEnd(widths[i])).join("  "))
  }
}

let server = null
async function ensureServer() {
  try {
    const res = await fetch(BASE_URL)
    if (res.ok) return
  } catch {
    // fall through, start our own
  }
  const port = new URL(BASE_URL).port
  server = spawn("node", ["scripts/serve-dist.mjs"], {
    cwd: ROOT,
    env: { ...process.env, PORT: port || "9082" },
    stdio: "ignore",
  })
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE_URL)
      if (res.ok) return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error(`Server on ${BASE_URL} did not start`)
}

async function waitForDashboard(page) {
  // Demo data is loaded when the day's totals are on screen (the calendar
  // button and meal rows are aria-labeled, so innerText won't see them).
  // Compare lowercased: labels render through CSS text-transform.
  await page.waitForFunction(
    () => {
      const body = (document.body?.innerText ?? "").toLowerCase()
      return body.includes("kcal") && body.includes("protein") && body.includes("breakfast")
    },
    { timeout: 90_000 },
  )
}

/**
 * Audit one route inside an already-running browser. A fresh page carries the
 * emulated color scheme; Lighthouse drives its own navigation on that page.
 */
async function auditRoute(browser, debugPort, scheme, route) {
  const url = `${BASE_URL}${ROUTES[route]}`
  const page = await browser.newPage()
  try {
    const cdp = await page.createCDPSession()
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: scheme }],
    })

    const runnerResult = await lighthouse(url, { ...lighthouseFlags, port: debugPort }, null, page)
    if (!runnerResult) throw new Error(`Lighthouse produced no result for ${url}`)
    const lhr = runnerResult.lhr
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
    mkdirSync(OUT_DIR, { recursive: true })
    const base = join(OUT_DIR, `${route}-${scheme}-${PRESET}-${stamp}`)
    const formats = lighthouseFlags.output
    for (let i = 0; i < formats.length; i++) {
      writeFileSync(`${base}.${formats[i]}`, runnerResult.report[i])
    }
    console.log(`Report saved to ${base}.html`)
    return { name: route, scheme, categories: lhr.categories }
  } finally {
    await page.close().catch(() => {})
  }
}

async function runScheme(chromePath, scheme, routes) {
  const profileDir = join(tmpdir(), `dietinator-lh-${scheme}-${Date.now()}`)
  mkdirSync(profileDir, { recursive: true })
  const browser = await launchChrome({
    executablePath: chromePath,
    headless: true,
    userDataDir: profileDir,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--window-size=412,823",
    ],
  })
  try {
    // Seed demo DB + auth once per profile on a warm-up page, then CLOSE it.
    // Closing terminates the SQLite worker and releases its OPFS handles
    // before the audited navigations start ("Invalid VFS state" races
    // otherwise).
    const warmupPage = await browser.newPage()
    await warmupPage.goto(`${BASE_URL}/?demo=1`, { waitUntil: "networkidle2", timeout: 90_000 })
    await waitForDashboard(warmupPage)
    await new Promise((r) => setTimeout(r, 1500))
    await warmupPage.close()
    await new Promise((r) => setTimeout(r, 2000))

    const results = []
    const debugPort = Number(new URL(browser.wsEndpoint()).port)
    for (const route of routes) {
      console.log(`Auditing ${route} (${scheme}, preset=${PRESET})...`)
      results.push(await auditRoute(browser, debugPort, scheme, route))
    }
    return results
  } finally {
    await browser.close().catch(() => {})
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
        break
      } catch {
        await new Promise((r) => setTimeout(r, 300))
      }
    }
  }
}

async function main() {
  const chromePath = findChrome()
  if (!chromePath) {
    throw new Error("No Chrome/Chromium found. Install one or point CHROME_PATH at the binary.")
  }
  console.log(`Using Chrome at ${chromePath}`)
  await ensureServer()

  const results = []
  for (const scheme of schemes) {
    results.push(...(await runScheme(chromePath, scheme, auditRoutes)))
  }

  console.log(`\n=== Lighthouse scores (preset=${PRESET}) ===`)
  printTable(results)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    if (server) server.kill("SIGTERM")
  })
