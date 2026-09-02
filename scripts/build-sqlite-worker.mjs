import { build } from "esbuild"
import { existsSync } from "node:fs"

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
console.log("worker built: public/worker.js + wasm")
