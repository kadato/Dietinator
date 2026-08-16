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
 * - Launches Chrome with a persistent profile
 * - Optionally (REAL_LOGIN=1) logs in with the real YAZIO credentials from
 *   .env.local as a smoke check that the login flow works
 * - Runs a Lighthouse audit per route (default: /)
 * - Saves HTML + JSON reports to lighthouse-reports/ and prints the score table
 *
 * Usage:
 *   npm run build:web
 *   npm run serve:web            (other terminal)
 *   node scripts/lighthouse-run.mjs [/search /settings ...]
 *
 * Env:
 *   BASE_URL    (default http://localhost:8082)
 *   PRESET      mobile (default) | desktop
 *   REAL_LOGIN  1 to smoke-check the real YAZIO login before auditing
 *   REPORT_DIR  (default lighthouse-reports/)
 */
import { launch } from "chrome-launcher"
import { chromium } from "playwright"
import lighthouse from "lighthouse"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import os from "node:os"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const envPath = join(ROOT, ".env.local")
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2]
  }
} catch {
  // .env.local may be absent — rely on process env
}

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8082"
const PRESET = process.env.PRESET ?? "mobile"
const REAL_LOGIN = process.env.REAL_LOGIN === "1"
const CHROME_PATH =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const PROFILE_DIR = process.env.CHROME_PROFILE ?? join(os.tmpdir(), "dietinator-lighthouse-profile")
const OUT_DIR = process.env.REPORT_DIR ?? join(ROOT, "lighthouse-reports")
const EMAIL = process.env.YAZIO_EMAIL
const PASSWORD = process.env.YAZIO_PASSWORD

const ROUTE_NAMES = { "/": "dashboard", "/stats": "stats", "/settings": "settings" }
const requested = process.argv.slice(2)
const targets = requested.length ? requested : ["/"]

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
    : {}),
}

function printTable(results) {
  const header = ["route", "perf", "a11y", "bp", "seo"]
  const rows = results.map((r) => [
    r.name,
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
async function smokeCheckRealLogin(browser) {
  if (!EMAIL || !PASSWORD) {
    console.error("REAL_LOGIN=1 but YAZIO_EMAIL / YAZIO_PASSWORD not set (see .env.local)")
    return
  }
  const page = await browser.newPage()
  page.setDefaultTimeout(120_000)
  try {
    await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" })
    await page.getByPlaceholder("YAZIO email").fill(EMAIL)
    await page.getByPlaceholder("Password").fill(PASSWORD)
    await page.getByRole("button", { name: /Sign in with YAZIO/i }).click()
    await page.getByText("Meals", { exact: true }).waitFor({ timeout: 120_000 })
    console.log("Real YAZIO login OK — dashboard visible.")
  } finally {
    await page.close()
  }
}

function auditUrl(route) {
  // Demo mode seeds an authenticated session inside the audit's own storage
  // partition and lands on the real dashboard.
  return BASE_URL + route + "?demo=1"
}

async function runAudit(browserPort, route, name) {
  const url = auditUrl(route)
  console.log(`\nAuditing ${name} (${url}, preset=${PRESET})...`)
  const flags = { ...lighthouseFlags, port: browserPort }
  const runnerResult = await lighthouse(url, flags, null)
  if (!runnerResult) throw new Error(`Lighthouse produced no result for ${url}`)
  const lhr = runnerResult.lhr
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  mkdirSync(OUT_DIR, { recursive: true })
  const base = join(OUT_DIR, `${name}-${PRESET}-${stamp}`)
  const formats = lighthouseFlags.output
  for (let i = 0; i < formats.length; i++) {
    writeFileSync(`${base}.${formats[i]}`, runnerResult.report[i])
  }
  console.log(`Report saved to ${base}.html`)
  return { name, url, categories: lhr.categories }
}

const chrome = await launch({
  chromePath: CHROME_PATH,
  userDataDir: mkdirSync(PROFILE_DIR, { recursive: true }),
  chromeFlags: [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-extensions",
  ],
})

try {
  const browser = await chromium.connectOverCDP(`http://localhost:${chrome.port}`)
  try {
    if (REAL_LOGIN) await smokeCheckRealLogin(browser)
    const results = []
    for (const route of targets) {
      results.push(await runAudit(chrome.port, route, ROUTE_NAMES[route] ?? route.replace("/", "")))
    }
    console.log("\n=== Lighthouse scores (preset=" + PRESET + ") ===")
    printTable(results)
  } finally {
    // Graceful close first so the browser flushes localStorage/IndexedDB to
    // disk, then kill as a fallback.
    await browser.close().catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
} finally {
  try {
    chrome.kill()
  } catch {
    // Windows sometimes holds the temp profile open — ignore cleanup errors
  }
}
