#!/usr/bin/env node
/**
 * Lighthouse runner for the Dietinator web build.
 *
 * Audits the authenticated dashboard via the app's own `?demo=1` flow: the
 * COOP/COEP headers that wa-sqlite requires partition localStorage per
 * browsing context group, so a browser profile's login can never be shared
 * into a Lighthouse audit tab. Demo mode is the app's supported, e2e-tested
 * way to reach the real dashboard without credentials.
 *
 * - Launches Chrome with a fresh per-audit profile
 * - Runs a Lighthouse audit per route in light AND dark color schemes
 *   (dark is driven via CDP Emulation.setEmulatedMedia, since the
 *   `--force-prefers-color-scheme` flag is ignored by modern headless Chrome)
 * - Optionally (REAL_LOGIN=1) logs in with the real YAZIO credentials from
 *   .env.local as a smoke check that the login flow works
 * - Saves HTML + JSON reports to lighthouse-reports/ and prints the score table
 *
 * Usage:
 *   npm run build:web
 *   node scripts/lighthouse-run.mjs [/search /settings ...]
 *
 * Env:
 *   BASE_URL    (default http://localhost:9082, because 8082 is excluded by Hyper-V
 *                on Windows, so 9082 works out of the box; point at a running
 *                `npm run serve:web` or let this script start one)
 *   PRESET      mobile (default) | desktop
 *   REAL_LOGIN  1 to smoke-check the real YAZIO login before auditing
 *   REPORT_DIR  (default lighthouse-reports/)
 *   THEME       light | dark | both (default both)
 *   LH_ROUTES   comma-separated route names (dashboard,stats,log-meal,ai,settings)
 */
import { spawn, execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import os from "node:os"
import { launch } from "chrome-launcher"
import { chromium } from "playwright"
import puppeteer from "puppeteer-core"
import lighthouse from "lighthouse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const envPath = join(ROOT, ".env.local")
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2]
  }
} catch {
  // .env.local may be absent, rely on process env
}

// 8082 is the historical default but Windows Hyper-V excludes 8081-8180.
const BASE_URL = process.env.BASE_URL ?? "http://localhost:9082"
const PRESET = process.env.PRESET ?? "mobile"
const REAL_LOGIN = process.env.REAL_LOGIN === "1"
const THEME = process.env.THEME ?? "both"
const CHROME_PATH =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const OUT_DIR = process.env.REPORT_DIR ?? join(ROOT, "lighthouse-reports")
const EMAIL = process.env.YAZIO_EMAIL
const PASSWORD = process.env.YAZIO_PASSWORD

const ROUTES = {
  dashboard: "/?demo=1",
  stats: "/stats?demo=1",
  "log-meal": "/log-meal?meal=lunch&demo=1",
  ai: "/ai?demo=1",
  settings: "/settings?demo=1",
}

const requested = process.argv.slice(2)
const targets = requested.length ? requested : ["dashboard"]
const LH_ROUTES = (process.env.LH_ROUTES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((name) => ROUTES[name])
const auditRoutes = LH_ROUTES.length > 0 ? LH_ROUTES : targets
const schemes = THEME === "light" ? ["light"] : THEME === "dark" ? ["dark"] : ["light", "dark"]

const lighthouseFlags = {
  output: ["html", "json"],
  onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
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
    ...["performance", "accessibility", "best-practices", "seo"].map((id) => {
      const category = r.categories[id]
      return !category || category.score === null || category.score === undefined
        ? "-"
        : String(Math.round(category.score * 100))
    }),
  ])
  const widths = header.map((_, i) =>
    Math.max(header[i].length, ...rows.map((row) => row[i].length)),
  )
  console.log(header.map((cell, i) => cell.padEnd(widths[i])).join("  "))
  for (const row of rows) {
    console.log(row.map((cell, i) => cell.padEnd(widths[i])).join("  "))
  }
}

/** Smoke-check the real YAZIO login (optional; audits still use demo mode). */
async function smokeCheckRealLogin() {
  if (!EMAIL || !PASSWORD) {
    console.error("REAL_LOGIN=1 but YAZIO_EMAIL / YAZIO_PASSWORD not set (see .env.local)")
    return
  }
  const browser = await chromium.launch({ headless: true, channel: "chrome" })
  const page = await browser.newPage()
  page.setDefaultTimeout(120_000)
  try {
    await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" })
    await page.getByPlaceholder("YAZIO email").fill(EMAIL)
    await page.getByPlaceholder("Password").fill(PASSWORD)
    await page.getByRole("button", { name: /Sign in with YAZIO/i }).click()
    await page.getByText("Meals", { exact: true }).waitFor({ timeout: 120_000 })
    console.log("Real YAZIO login OK, dashboard visible.")
  } finally {
    await page.close()
    await browser.close()
  }
}

// Force-kill any Chrome processes still using the given profile dir. On
// Windows, orphaned headless Chrome children keep the profile's SingletonLock
// and make the next launch exit immediately (ECONNREFUSED on the debug port).
function killChromeForProfile(dir) {
  const ps = `Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | Where-Object { $_.CommandLine -like '*${dir}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`
  try {
    execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], {
      stdio: "ignore",
    })
  } catch {
    // Best effort; removal below retries until the lock clears.
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
}

// Kill the whole Chrome process tree by browser PID (taskkill /T), much more
// reliable than chrome-launcher's kill(), which can leave orphaned children.
function killChromeTree(pid) {
  if (!pid) return
  try {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore" })
  } catch {
    // Process already gone.
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
}

// Chrome holds the profile dir lock briefly after exit, which makes a naive
// rmSync throw EPERM on Windows. Kill stragglers, then retry with backoff.
function removeProfileDir(dir) {
  if (!existsSync(dir)) return
  killChromeForProfile(dir)
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
      return
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300)
    }
  }
}

async function waitForDashboard(page) {
  // Demo data is loaded when the day's totals are on screen (the calendar
  // button and meal rows are aria-labeled, so innerText won't see them).
  await page.waitForFunction(
    () => {
      const body = document.body?.innerText ?? ""
      return body.includes("kcal") && body.includes("Protein") && body.includes("Breakfast")
    },
    { timeout: 90_000 },
  )
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

async function runAuditOnce(scheme, route) {
  const url = `${BASE_URL}${ROUTES[route]}`
  const profileDir = join(os.tmpdir(), `dietinator-lh-${scheme}-${route}-${Date.now()}`)
  mkdirSync(profileDir, { recursive: true })

  const chrome = await launch({
    chromePath: CHROME_PATH,
    userDataDir: profileDir,
    chromeFlags: [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--window-size=412,823",
    ],
  })

  let browser = null
  try {
    // Guard against a stale DevToolsActivePort file: verify the debug port is
    // actually reachable before puppeteer connects.
    let debugReady = false
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${chrome.port}/json/version`)
        if (res.ok) {
          debugReady = true
          break
        }
      } catch {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
      }
    }
    if (!debugReady) throw new Error(`Chrome debug port ${chrome.port} never came up`)

    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` })

    // Seed demo DB + auth in a warm-up navigation on its own page, then CLOSE
    // that page. Closing it terminates its SQLite worker and releases its OPFS
    // access handles before the audited navigation starts. The audited load's
    // fresh worker would otherwise occasionally fail its one-time VFS init by
    // racing the old worker's teardown ("Invalid VFS state").
    const warmupPage = await browser.newPage()
    await warmupPage.goto(`${BASE_URL}/?demo=1`, { waitUntil: "networkidle2", timeout: 90_000 })
    await waitForDashboard(warmupPage)
    await new Promise((r) => setTimeout(r, 1500))
    await warmupPage.close()
    await new Promise((r) => setTimeout(r, 2000))

    const page = await browser.newPage()
    const cdp = await page.createCDPSession()
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: scheme }],
    })

    const runnerResult = await lighthouse(
      url,
      { ...lighthouseFlags, port: chrome.port },
      null,
      page,
    )
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
    if (browser) await browser.disconnect()
    try {
      await chrome.kill()
    } catch {
      // Fall through to the tree kill below.
    }
    killChromeTree(chrome.pid)
    removeProfileDir(profileDir)
  }
}

async function runAudit(scheme, route) {
  // Headless Chrome startup is flaky on Windows (antivirus, port races); retry
  // a few times before giving up.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await runAuditOnce(scheme, route)
    } catch (error) {
      console.log(
        `  attempt ${attempt} failed for ${route} (${scheme}): ${error.message?.slice(0, 120)}`,
      )
      if (attempt === 3) throw error
      await new Promise((r) => setTimeout(r, 2000 * attempt))
    }
  }
}

async function main() {
  await ensureServer()
  if (REAL_LOGIN) await smokeCheckRealLogin()
  const results = []
  for (const route of auditRoutes) {
    for (const scheme of schemes) {
      console.log(`\nAuditing ${route} (${scheme}, preset=${PRESET})...`)
      results.push(await runAudit(scheme, route))
    }
  }
  console.log("\n=== Lighthouse scores (preset=" + PRESET + ") ===")
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
