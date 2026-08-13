#!/usr/bin/env node
/**
 * One-command release: bump app.json (version + android.versionCode), commit,
 * and tag vX.Y.Z. Push the tag to trigger the release.yml pipeline.
 *
 * Usage: node scripts/release.cjs [major|minor|patch]
 *
 * Version derives from the highest existing v* tag (falls back to app.json).
 * The versionCode follows the same deterministic scheme as ci-set-version.cjs
 * (major * 10000 + minor * 100 + patch) so it never decreases.
 */
const { execSync } = require("child_process")
const fs = require("fs")

const bump = process.argv[2] ?? "patch"
if (!["major", "minor", "patch"].includes(bump)) {
  console.error("Usage: node scripts/release.cjs [major|minor|patch]")
  process.exit(1)
}

const appJson = JSON.parse(fs.readFileSync("app.json", "utf8"))
const latestTag = execSync("git tag --sort=-version:refname", {
  encoding: "utf8",
})
  .trim()
  .split("\n")[0]
  ?.match(/^v(\d+)\.(\d+)\.(\d+)$/)

const base = latestTag
  ? latestTag.slice(1).map(Number)
  : (appJson.expo.version ?? "0.0.0").split(".").map(Number)

const [major, minor, patch] =
  bump === "major"
    ? [base[0] + 1, 0, 0]
    : bump === "minor"
      ? [base[0], base[1] + 1, 0]
      : [base[0], base[1], base[2] + 1]

const version = `${major}.${minor}.${patch}`
const versionCode = major * 10000 + minor * 100 + patch

appJson.expo.version = version
appJson.expo.android = { ...(appJson.expo.android ?? {}), versionCode }
fs.writeFileSync("app.json", JSON.stringify(appJson, null, 2) + "\n")

// Keep CI's format:check green: prettier collapses the single-element
// permissions array, which plain JSON.stringify leaves expanded.
execSync("npx prettier --write app.json", { stdio: "inherit" })

execSync("git add app.json", { stdio: "inherit" })
execSync(`git commit -m "chore(release): v${version}"`, { stdio: "inherit" })
execSync(`git tag v${version}`, { stdio: "inherit" })

console.log(`
Released v${version} (versionCode ${versionCode}).
Next: git push && git push origin v${version} — release.yml builds the signed APK.
`)
