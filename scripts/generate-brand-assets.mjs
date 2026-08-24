import { chromium } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { join } from "node:path"

const ASSETS_DIR = join(process.cwd(), "assets")
mkdirSync(ASSETS_DIR, { recursive: true })

/**
 * Returns the SVG markup for the simple minimalist brutalist Dietinator glyph.
 * Size is 1024x1024 with viewBox="0 0 1024 1024".
 * Zero soft glows/filters, pure bold geometric slabs, sharp miter corners.
 */
function createBrutalistGlyphSvg({ isMonochrome = false, size = 1024 } = {}) {
  const blue = isMonochrome ? "#ffffff" : "#6aa8ff" // Protein
  const amber = isMonochrome ? "#ffffff" : "#FFB020" // Carbs
  const pink = isMonochrome ? "#ffffff" : "#ff7a92" // Fat
  const primary = isMonochrome ? "#ffffff" : "#7aa2f7" // Primary Tokyo Night
  const white = "#ffffff"
  const darkSurface = isMonochrome ? "#000000" : "#24283b"

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${size}" height="${size}">
  <!-- Outer Minimalist Brutalist Frame (Square with corner notches) -->
  <path d="M 220 160 L 804 160 L 864 220 L 864 804 L 804 864 L 220 864 L 160 804 L 160 220 Z"
        fill="none" stroke="${primary}" stroke-width="16" stroke-linejoin="miter" />

  <!-- 3 Minimalist Macro Notch Blocks on Top Right -->
  <rect x="680" y="196" width="36" height="16" fill="${blue}" />
  <rect x="732" y="196" width="36" height="16" fill="${amber}" />
  <rect x="784" y="196" width="36" height="16" fill="${pink}" />

  <!-- Massive Brutalist Monolithic "D" Emblem -->
  <!-- 1. Left Heavy Spine (Protein / Primary) -->
  <polygon points="260,260 400,260 400,764 260,764" fill="${primary}" />

  <!-- 2. Top Heavy Slab (Protein Blue) -->
  <polygon points="400,260 660,260 764,364 660,364 400,364" fill="${blue}" />

  <!-- 3. Right Angular Faceted Block (Carbs Amber) -->
  <polygon points="660,260 764,364 764,660 660,764 660,660 660,364" fill="${amber}" />

  <!-- 4. Bottom Heavy Slab (Fat Pink) -->
  <polygon points="400,660 660,660 764,660 660,764 400,764" fill="${pink}" />

  <!-- Central Dark Negative Space Core -->
  <polygon points="400,364 610,364 660,414 660,610 610,660 400,660" fill="${darkSurface}" />

  <!-- Stark Minimalist Energy Bolt / Cross Core in Pure White -->
  <polygon points="530,390 470,500 520,500 480,620 570,490 520,490" fill="${white}" />

  <!-- Brutalist Coordinate / Scale Markings -->
  <line x1="160" y1="512" x2="220" y2="512" stroke="${primary}" stroke-width="12" />
  <line x1="804" y1="512" x2="864" y2="512" stroke="${primary}" stroke-width="12" />
  <line x1="512" y1="160" x2="512" y2="220" stroke="${primary}" stroke-width="12" />
  <line x1="512" y1="804" x2="512" y2="864" stroke="${primary}" stroke-width="12" />
</svg>
`
}

function createHtml(svgContent, bg = "#1a1b26") {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background-color: ${bg};
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
  svg {
    width: 100%;
    height: 100%;
  }
</style>
</head>
<body>
  ${svgContent}
</body>
</html>`
}

async function generateAll() {
  const browser = await chromium.launch({ headless: true })

  // 1. FULL APP ICON (1024x1024)
  console.log("Generating minimalist brutalist icon.png (1024x1024)...")
  const iconPage = await browser.newPage({
    viewport: { width: 1024, height: 1024 },
    deviceScaleFactor: 1,
  })
  const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="#1a1b26" />
  ${createBrutalistGlyphSvg()}
</svg>`
  await iconPage.setContent(createHtml(iconSvg, "#1a1b26"))
  await iconPage.waitForTimeout(100)
  await iconPage.screenshot({ path: join(ASSETS_DIR, "icon.png") })
  await iconPage.close()

  // 2. ANDROID ADAPTIVE BACKGROUND (1024x1024)
  console.log("Generating android-icon-background.png (1024x1024)...")
  const bgPage = await browser.newPage({
    viewport: { width: 1024, height: 1024 },
    deviceScaleFactor: 1,
  })
  const bgSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="#1a1b26" />
</svg>`
  await bgPage.setContent(createHtml(bgSvg, "#1a1b26"))
  await bgPage.waitForTimeout(100)
  await bgPage.screenshot({ path: join(ASSETS_DIR, "android-icon-background.png") })
  await bgPage.close()

  // 3. ANDROID ADAPTIVE FOREGROUND (1024x1024 with transparent background)
  console.log("Generating android-icon-foreground.png (1024x1024)...")
  const fgPage = await browser.newPage({
    viewport: { width: 1024, height: 1024 },
    deviceScaleFactor: 1,
  })
  const fgSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <g transform="translate(512, 512) scale(0.8) translate(-512, -512)">
    ${createBrutalistGlyphSvg()}
  </g>
</svg>`
  await fgPage.setContent(createHtml(fgSvg, "transparent"))
  await fgPage.waitForTimeout(100)
  await fgPage.screenshot({
    path: join(ASSETS_DIR, "android-icon-foreground.png"),
    omitBackground: true,
  })
  await fgPage.close()

  // 4. ANDROID ADAPTIVE MONOCHROME (1024x1024)
  console.log("Generating android-icon-monochrome.png (1024x1024)...")
  const monoPage = await browser.newPage({
    viewport: { width: 1024, height: 1024 },
    deviceScaleFactor: 1,
  })
  const monoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <g transform="translate(512, 512) scale(0.8) translate(-512, -512)">
    ${createBrutalistGlyphSvg({ isMonochrome: true })}
  </g>
</svg>`
  await monoPage.setContent(createHtml(monoSvg, "transparent"))
  await monoPage.waitForTimeout(100)
  await monoPage.screenshot({
    path: join(ASSETS_DIR, "android-icon-monochrome.png"),
    omitBackground: true,
  })
  await monoPage.close()

  // 5. SPLASH SCREEN ICON (512x512)
  console.log("Generating splash-icon.png (512x512)...")
  const splashPage = await browser.newPage({
    viewport: { width: 512, height: 512 },
    deviceScaleFactor: 1,
  })
  const splashSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <g transform="translate(256, 256) scale(0.55) translate(-512, -512)">
    ${createBrutalistGlyphSvg()}
  </g>
</svg>`
  await splashPage.setContent(createHtml(splashSvg, "transparent"))
  await splashPage.waitForTimeout(100)
  await splashPage.screenshot({ path: join(ASSETS_DIR, "splash-icon.png"), omitBackground: true })
  await splashPage.close()

  // 6. FAVICON (64x64)
  console.log("Generating favicon.png (64x64)...")
  const favPage = await browser.newPage({
    viewport: { width: 64, height: 64 },
    deviceScaleFactor: 1,
  })
  const favSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="64" height="64">
  <rect width="1024" height="1024" fill="#1a1b26" />
  <g transform="translate(512, 512) scale(0.92) translate(-512, -512)">
    ${createBrutalistGlyphSvg()}
  </g>
</svg>`
  await favPage.setContent(createHtml(favSvg, "#1a1b26"))
  await favPage.waitForTimeout(100)
  await favPage.screenshot({ path: join(ASSETS_DIR, "favicon.png") })
  await favPage.close()

  await browser.close()
  console.log("\nAll minimalist brutalist brand assets generated successfully!\n")
}

generateAll().catch((err) => {
  console.error("Failed to generate brand assets:", err)
  process.exit(1)
})
