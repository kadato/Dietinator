#!/usr/bin/env node
/**
 * Post-process the Expo web export (`dist/`) for Cloudflare Pages.
 *
 * Fixes:
 * 1. PWA icons: manifest points at /assets/icon.png but the export does not
 *    emit it. Copy icons into dist so the manifest resolves with 200 instead
 *    of falling through to the SPA redirect and returning HTML.
 * 2. SQLite wasm: expo-sqlite ships wa-sqlite.wasm under a pnpm store path
 *    that contains ".pnpm" (dot directory). Some static hosts do not publish
 *    dot paths, so the fetch returns HTML and wasm fails with
 *    "expected magic 00 61 73 6d, found 3c 21 44 4f" (HTML). Copy the wasm to
 *    a clean URL and patch the JS bundles.
 * 3. Bundled fonts (legacy): app/+html.tsx previously hard-coded
 *    /assets/fonts/DepartureMono-Regular.otf, but Metro emits the font at
 *    /assets/assets/fonts/DepartureMono-Regular.<hash>.otf. Older HTML shells
 *    and cached service workers still request the unhashed path and would hit
 *    the SPA fallback (HTML) with "OTS parsing error: invalid sfntVersion".
 *    Keep the copy for one release cycle after the HTML now loads the font
 *    via src/utils/web-fonts.ts only. See app/+html.tsx for the current
 *    approach.
 * 4. Vector icons: @expo/vector-icons ships fonts under a .pnpm dot path
 *    (e.g. /assets/node_modules/.pnpm/.../Feather.ttf). Pages returns HTML
 *    for that dot path on the current Pages build, so icons fail with OTS
 *    errors and the app shows no icons. Copy each ttf to a clean
 *    /assets/<basename> and patch JS bundles. This stays needed while
 *    pnpm uses an isolated linker (symlinks to .pnpm). Alternative is
 *    `nodeLinker: hoisted` in pnpm-workspace.yaml, which trades isolation
 *    for clean URLs.
 */

import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join, basename, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const DIST = join(ROOT, "dist")
const ASSETS_SRC = join(ROOT, "assets")
const PUBLIC_ASSETS = join(ROOT, "public", "assets")

function ensureIcons() {
  if (!existsSync(DIST)) {
    console.warn("[fix-web-build] dist/ missing, skip icon fix")
    return
  }
  const targetDir = join(DIST, "assets")
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true })
  for (const name of ["icon.png", "favicon.png"]) {
    const dst = join(targetDir, name)
    if (existsSync(dst)) {
      console.log(`[fix-web-build] icon ok: ${relative(ROOT, dst)}`)
      continue
    }
    const srcCandidates = [join(PUBLIC_ASSETS, name), join(ASSETS_SRC, name)]
    const src = srcCandidates.find(existsSync)
    if (!src) {
      console.warn(`[fix-web-build] icon source missing for ${name}`)
      continue
    }
    cpSync(src, dst)
    console.log(`[fix-web-build] copied ${relative(ROOT, src)} -> ${relative(ROOT, dst)}`)
  }
}

function fixWasm() {
  if (!existsSync(DIST)) {
    console.warn("[fix-web-build] dist/ missing, skip wasm fix")
    return
  }
  const assetsRoot = join(DIST, "assets")
  if (!existsSync(assetsRoot)) {
    console.warn("[fix-web-build] dist/assets missing, skip wasm fix")
    return
  }
  const wasmFiles = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith(".wasm")) wasmFiles.push(full)
    }
  }
  walk(DIST)
  const waSqliteFiles = wasmFiles.filter((p) => p.includes("wa-sqlite"))
  if (waSqliteFiles.length === 0) {
    console.warn("[fix-web-build] no wa-sqlite wasm found under dist/")
    return
  }
  for (const src of waSqliteFiles) {
    const base = basename(src)
    const cleanDst = join(assetsRoot, base)
    if (!existsSync(cleanDst)) {
      cpSync(src, cleanDst)
      console.log(`[fix-web-build] wasm copy ${relative(ROOT, src)} -> ${relative(ROOT, cleanDst)}`)
    } else {
      console.log(`[fix-web-build] wasm clean copy already exists: ${relative(ROOT, cleanDst)}`)
    }
  }
  const jsRoot = join(DIST, "_expo", "static", "js", "web")
  let jsFiles = []
  if (existsSync(jsRoot)) {
    jsFiles = readdirSync(jsRoot)
      .filter((n) => n.endsWith(".js"))
      .map((n) => join(jsRoot, n))
  } else {
    const walkJs = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) walkJs(full)
        else if (full.endsWith(".js")) jsFiles.push(full)
      }
    }
    walkJs(DIST)
  }
  const wasmUrlPattern = /\/assets\/node_modules\/\.pnpm\/[^"']*?wa-sqlite\.[^"']*?\.wasm/g
  let patchedCount = 0
  for (const jsPath of jsFiles) {
    let text = readFileSync(jsPath, "utf8")
    if (!wasmUrlPattern.test(text)) continue
    wasmUrlPattern.lastIndex = 0
    const original = text
    text = text.replace(wasmUrlPattern, (matched) => {
      const base = basename(matched)
      const clean = `/assets/${base}`
      console.log(`[fix-web-build] patch ${basename(jsPath)}: ${matched} -> ${clean}`)
      return clean
    })
    if (text !== original) {
      writeFileSync(jsPath, text, "utf8")
      patchedCount++
    }
  }
  if (patchedCount === 0) console.log("[fix-web-build] no JS files needed wasm path patching")
  else console.log(`[fix-web-build] patched ${patchedCount} JS bundle(s)`)
}

function ensureFonts() {
  if (!existsSync(DIST)) {
    console.warn("[fix-web-build] dist/ missing, skip font fix")
    return
  }
  const expectedPath = join(DIST, "assets", "fonts", "DepartureMono-Regular.otf")
  if (existsSync(expectedPath)) {
    console.log(`[fix-web-build] font ok: ${relative(ROOT, expectedPath)}`)
    return
  }
  // Find the hashed font Metro emitted (assets/assets/fonts/DepartureMono-Regular.<hash>.otf)
  const candidates = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.startsWith("DepartureMono-Regular") && entry.name.endsWith(".otf")) {
        candidates.push(full)
      }
    }
  }
  walk(DIST)
  if (candidates.length === 0) {
    console.warn("[fix-web-build] no DepartureMono font found under dist/")
    return
  }
  // Prefer the hashed one under assets/assets/fonts
  candidates.sort((a, b) => b.length - a.length)
  const src = candidates[0]
  mkdirSync(join(DIST, "assets", "fonts"), { recursive: true })
  cpSync(src, expectedPath)
  console.log(`[fix-web-build] font copy ${relative(ROOT, src)} -> ${relative(ROOT, expectedPath)}`)
}

function fixVectorIcons() {
  if (!existsSync(DIST)) {
    console.warn("[fix-web-build] dist/ missing, skip vector-icons fix")
    return
  }
  const assetsRoot = join(DIST, "assets")
  if (!existsSync(assetsRoot)) {
    console.warn("[fix-web-build] dist/assets missing, skip vector-icons fix")
    return
  }
  const ttfFiles = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (full.includes(".pnpm") && entry.name.endsWith(".ttf")) ttfFiles.push(full)
    }
  }
  walk(DIST)
  if (ttfFiles.length === 0) {
    console.log("[fix-web-build] no .pnpm ttf files found, skip vector-icons fix")
    return
  }
  for (const src of ttfFiles) {
    const base = basename(src)
    const cleanDst = join(assetsRoot, base)
    if (!existsSync(cleanDst)) {
      cpSync(src, cleanDst)
      console.log(
        `[fix-web-build] icon font copy ${relative(ROOT, src)} -> ${relative(ROOT, cleanDst)}`,
      )
    }
  }
  const jsRoot = join(DIST, "_expo", "static", "js", "web")
  let jsFiles = []
  if (existsSync(jsRoot)) {
    jsFiles = readdirSync(jsRoot)
      .filter((n) => n.endsWith(".js"))
      .map((n) => join(jsRoot, n))
  } else {
    const walkJs = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) walkJs(full)
        else if (full.endsWith(".js")) jsFiles.push(full)
      }
    }
    walkJs(DIST)
  }
  const ttfUrlPattern = /\/assets\/node_modules\/\.pnpm\/[^"']*?\.ttf/g
  let patchedCount = 0
  for (const jsPath of jsFiles) {
    let text = readFileSync(jsPath, "utf8")
    if (!ttfUrlPattern.test(text)) continue
    ttfUrlPattern.lastIndex = 0
    const original = text
    text = text.replace(ttfUrlPattern, (matched) => {
      const base = basename(matched)
      const clean = `/assets/${base}`
      console.log(`[fix-web-build] patch ${basename(jsPath)}: ${matched} -> ${clean}`)
      return clean
    })
    if (text !== original) {
      writeFileSync(jsPath, text, "utf8")
      patchedCount++
    }
  }
  if (patchedCount === 0) console.log("[fix-web-build] no JS files needed vector-icons patching")
  else console.log(`[fix-web-build] patched ${patchedCount} JS bundle(s) for vector-icons`)
}

function syncServiceWorker() {
  try {
    const publicSw = join(ROOT, "public", "sw.js")
    const distSw = join(DIST, "sw.js")
    if (existsSync(publicSw) && existsSync(distSw)) {
      const pub = readFileSync(publicSw, "utf8")
      const cur = readFileSync(distSw, "utf8")
      if (pub !== cur) {
        cpSync(publicSw, distSw)
        console.log("[fix-web-build] synced dist/sw.js from public/sw.js")
      }
    }
  } catch (err) {
    console.warn("[fix-web-build] sw.js sync failed:", err.message)
  }
}

function syncHeaders() {
  try {
    const publicHeaders = join(ROOT, "public", "_headers")
    const distHeaders = join(DIST, "_headers")
    if (existsSync(publicHeaders) && existsSync(distHeaders)) {
      const pub = readFileSync(publicHeaders, "utf8")
      const cur = readFileSync(distHeaders, "utf8")
      if (pub !== cur) {
        cpSync(publicHeaders, distHeaders)
        console.log("[fix-web-build] synced dist/_headers from public/_headers")
      }
    }
  } catch (err) {
    console.warn("[fix-web-build] _headers sync failed:", err.message)
  }
}

ensureIcons()
fixWasm()
ensureFonts()
fixVectorIcons()
syncServiceWorker()
syncHeaders()
console.log("[fix-web-build] done")
