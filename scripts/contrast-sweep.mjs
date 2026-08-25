#!/usr/bin/env node
/**
 * Contrast + screenshot sweep for the Dietinator web build.
 *
 * Walks every visible text node on each route and computes WCAG contrast
 * against the effective background (alpha-composited through ancestors).
 * Captures a screenshot per route/scheme so theme consistency can be
 * reviewed by eye.
 *
 * Usage: node scripts/contrast-sweep.mjs [outDir]   (default /tmp/opencode/shots)
 */
import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { join } from "node:path"

const BASE = process.env.BASE_URL ?? "http://localhost:9082"
const OUT = process.argv[2] ?? "/tmp/opencode/shots"
mkdirSync(OUT, { recursive: true })

const PAGES = [
  ["dashboard", "/"],
  ["stats", "/stats"],
  ["ai", "/ai"],
  ["settings", "/settings"],
  ["log-meal", "/log-meal?meal=lunch"],
  ["create-options", "/create-options?meal=lunch"],
  ["manual-entry", "/manual-entry?meal=lunch"],
  ["meal-builder", "/meal-builder"],
  ["scan", "/scan?meal=lunch"],
  ["add-food", "/add-food?meal=lunch"],
]

const SCAN = `(() => {
  const lum = (c) => {
    const m = c.match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/)
    if (!m) return null
    if (m[4] !== undefined && Number(m[4]) === 0) return null
    const f = v => { v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4)}
    return 0.2126*f(+m[1])+0.7152*f(+m[2])+0.0722*f(+m[3])
  }
  const parse = (c) => c.match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/)?.slice(1).filter(v => v !== undefined).map(Number)
  const blend = (top, base) => {
    const p = parse(top), b = parse(base)
    if (!p || !b) return base
    const a = p[3]===undefined?1:p[3]
    return 'rgb('+[0,1,2].map(i=>Math.round(p[i]*a+b[i]*(1-a))).join(',')+')'
  }
  const bgOf = (el) => {
    let e = el
    while (e && e.nodeType === 1) {
      const c = getComputedStyle(e).backgroundColor
      const p = parse(c||'')
      if (p && (p.length<4 || p[3]>0)) return (p.length===4&&p[3]<1)? blend(c, bgOf(e.parentElement)||'rgb(255,255,255)') : c
      e = e.parentElement
    }
    return 'rgb(255,255,255)'
  }
  const fails = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  while (walker.nextNode()) {
    const t = walker.currentNode.textContent.trim()
    if (!t) continue
    const el = walker.currentNode.parentElement
    if (!el || seen.has(el)) continue
    seen.add(el)
    let pe = el, hidden = false
    while (pe) { const cs = getComputedStyle(pe); if (cs.display==='none'||cs.visibility==='hidden'){hidden=true;break} pe = pe.parentElement }
    if (hidden) continue
    const cs = getComputedStyle(el)
    const fg = cs.color, bg = bgOf(el)
    const l1 = lum(fg), l2 = lum(bg)
    if (l1===null||l2===null) continue
    const ratio = (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)
    const px = parseFloat(cs.fontSize)
    const bold = Number(cs.fontWeight)>=600
    const large = px>=24||(px>=18.66&&bold)
    const need = large?3:4.5
    if (ratio < need) fails.push({ t: t.slice(0,28), r: +ratio.toFixed(2), px:+px.toFixed(1), fg, bg })
  }
  return fails.slice(0, 10)
})()`

const browser = await chromium.launch({ headless: true })

for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: scheme,
  })
  const page = await ctx.newPage()
  // Seed the demo DB once so authenticated screens have content.
  await page.goto(`${BASE}/?demo=1`, { waitUntil: "networkidle" })
  await page
    .waitForFunction(
      () => {
        const b = (document.body?.innerText ?? "").toLowerCase()
        return b.includes("kcal") && b.includes("protein") && b.includes("breakfast")
      },
      { timeout: 60_000 },
    )
    .catch(() => console.log(`[${scheme}] warm-up wait timed out`))
  await page.waitForTimeout(1200)

  for (const [name, path] of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" })
    await page.waitForTimeout(1800)
    const fails = await page.evaluate(SCAN)
    await page.screenshot({ path: join(OUT, `${name}-${scheme}.png`), fullPage: false })
    console.log(
      `[${scheme}] ${name}: ${fails.length} contrast fails${fails.length ? " -> " : ""}` +
        fails.map((f) => `"${f.t}" ${f.r} (${f.fg} on ${f.bg})`).join(" | "),
    )
  }
  await ctx.close()
}

await browser.close()
console.log(`Screenshots in ${OUT}`)
