import { build } from "esbuild"
import { existsSync, readFileSync, writeFileSync } from "node:fs"

await build({
  entryPoints: ["node_modules/expo-sqlite/web/worker.ts"],
  bundle: true,
  outfile: "public/worker.js",
  format: "iife",
  platform: "browser",
  target: "es2020",
  loader: { ".wasm": "file" },
  assetNames: "[name]-[hash]",
  logLevel: "info",
})

if (!existsSync("public/worker.js")) {
  console.error("worker build failed")
  process.exit(1)
}

// Patch the worker to silence the expected wasm streaming MIME warning in dev.
// Metro serves wasm as octet-stream until the fix in metro.config.js lands, and
// the worker falls back to ArrayBuffer which works fine. Logging it as
// console.error makes the console red for no reason.
try {
  const path = "public/worker.js"
  let text = readFileSync(path, "utf8")
  const before = text
  text = text.replace(
    "err(`wasm streaming compile failed: ${reason}`);",
    'if (!String(reason).includes("Incorrect response MIME type")) err(`wasm streaming compile failed: ${reason}`);',
  )
  text = text.replace(
    'err("falling back to ArrayBuffer instantiation");',
    'if (!String(reason).includes("Incorrect response MIME type")) err("falling back to ArrayBuffer instantiation");',
  )
  if (text !== before) {
    writeFileSync(path, text, "utf8")
    console.log("patched worker.js to silence expected wasm MIME fallback")
  }
} catch {}

console.log("worker built: public/worker.js + wasm")
