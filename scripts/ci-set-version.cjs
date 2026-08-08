#!/usr/bin/env node
/**
 * CI helper: bake a release version into app.json before `expo prebuild`.
 * Usage: node scripts/ci-set-version.cjs <major.minor.patch>
 *
 * The versionCode is derived deterministically from the tag
 * (major * 10000 + minor * 100 + patch) so it never decreases.
 */
const fs = require("fs")

const version = process.argv[2]
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("Usage: node scripts/ci-set-version.cjs <major.minor.patch>")
  process.exit(1)
}

const appJson = JSON.parse(fs.readFileSync("app.json", "utf8"))
const [major, minor, patch] = version.split(".").map(Number)
const versionCode = major * 10000 + minor * 100 + patch

appJson.expo.version = version
appJson.expo.android = {
  ...(appJson.expo.android ?? {}),
  versionCode,
}

fs.writeFileSync("app.json", JSON.stringify(appJson, null, 2) + "\n")
console.log(`app.json -> version ${version}, versionCode ${versionCode}`)
