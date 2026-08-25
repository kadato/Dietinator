#!/usr/bin/env node
/**
 * Drive the Playwright MCP server over stdio (JSON-RPC) and verify the app:
 * boots the demo, switches the in-app theme, then navigates every route
 * capturing a11y snapshots and console errors.
 *
 * Usage: node scripts/mcp-verify.mjs [dark|light]
 */
import { spawn } from "node:child_process"

const BASE = process.env.BASE_URL ?? "http://localhost:9082"
const SCHEME = process.argv[2] ?? "dark"

const ROUTES = [
  ["/", "dashboard"],
  ["/stats", "stats"],
  ["/settings", "settings"],
  ["/log-meal?meal=lunch", "log-meal"],
  ["/create-options?meal=lunch", "create-options"],
  ["/manual-entry?meal=lunch", "manual-entry"],
  ["/meal-builder", "meal-builder"],
  ["/add-food?meal=lunch", "add-food"],
]

let nextId = 1
const pending = new Map()
const child = spawn(
  "npx",
  ["-y", "@playwright/mcp@latest", "--headless", "--browser", "chromium"],
  { stdio: ["pipe", "pipe", "inherit"] },
)
child.stdout.setEncoding("utf8")
let buf = ""
child.stdout.on("data", (chunk) => {
  buf += chunk
  let idx
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim()
    buf = buf.slice(idx + 1)
    if (!line) continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
  }
})

function call(method, params) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`${method} timed out`))
    }, 90_000)
    pending.set(id, (msg) => {
      clearTimeout(timer)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
    })
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n")
  })
}

async function tool(name, args) {
  const res = await call("tools/call", { name, arguments: args })
  if (res.isError) throw new Error(JSON.stringify(res.content).slice(0, 300))
  return (res.content ?? []).map((c) => c.text ?? "").join("\n")
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await call("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "dietinator-verify", version: "1.0.0" },
})
child.stdin.write(
  JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n",
)

// Boot the demo (seeds DB + auth in this profile).
await tool("browser_navigate", { url: `${BASE}/?demo=1` })
await sleep(6000)

// Switch the in-app theme so dark is driven by the app's own preference.
await tool("browser_navigate", { url: `${BASE}/settings` })
await sleep(3000)
const findGen = await tool("browser_find", { text: "General and Preferences" })
const genRef = new RegExp(
  `button "[^"]*General and Preferences[^"]*" \\[ref=([a-z0-9]+)`,
  "i",
).exec(findGen)?.[1]
if (genRef) {
  await tool("browser_click", { element: "General and Preferences section", target: genRef })
  await sleep(1500)
}
const findTheme = await tool("browser_find", { text: "Follow your device setting" })
const btnRef = (label) => {
  const re = new RegExp(`button "${label}" \\[ref=([a-z0-9]+)`, "i")
  return re.exec(findTheme)?.[1]
}
const target = SCHEME === "dark" ? btnRef("Dark") : btnRef("Light")
if (target) {
  await tool("browser_click", { element: `${SCHEME} theme button`, target })
  await sleep(1500)
  console.log(`Theme switched to ${SCHEME}.`)
} else {
  // The profile may already be on the requested theme from an earlier run.
  const state = await tool("browser_evaluate", {
    function: "() => ({ dark: document.documentElement.classList.contains('dark') })",
  })
  console.log(`Theme buttons not found; current html.dark state: ${state.trim()}`)
}
const themeNow = await tool("browser_evaluate", {
  function: "() => document.documentElement.classList.contains('dark') ? 'dark' : 'light'",
})
console.log(`Active theme: ${themeNow.trim()}`)
if (!themeNow.includes(SCHEME)) {
  console.log(`WARNING: requested ${SCHEME} but app is on ${themeNow.trim()}`)
}

let failures = 0
for (const [path, name] of ROUTES) {
  try {
    await tool("browser_navigate", { url: BASE + path })
    await sleep(3500)
    const snap = await tool("browser_snapshot", {})
    const text = typeof snap === "string" ? snap : JSON.stringify(snap)
    const errors = await tool("browser_console_messages", { level: "error" })
    const errText = typeof errors === "string" ? errors : JSON.stringify(errors)
    const errorLines = errText.split("\n").filter((l) => /error/i.test(l) && !/0 error/i.test(l))
    const ok = text.length > 200
    if (!ok) failures++
    console.log(
      `[${SCHEME}] ${name}: snapshot ${text.length} chars, ok=${ok}` +
        (errorLines.length ? `, console: ${errorLines[0].slice(0, 160)}` : ", console clean"),
    )
  } catch (error) {
    failures++
    console.log(`[${SCHEME}] ${name}: FAILED ${String(error.message).slice(0, 200)}`)
  }
}

console.log(failures ? `\n${failures} route(s) failed` : "\nAll routes verified")
child.kill("SIGTERM")
process.exit(failures ? 1 : 0)
