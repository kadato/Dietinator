#!/usr/bin/env node
/**
 * CI helper: point the Android release build at a real signing keystore.
 *
 * Runs after `npx expo prebuild` (which wires release builds to the debug
 * keystore). Injects a `release` signing config driven by environment
 * variables and switches the release buildType to use it:
 *
 *   DIETINATOR_KEYSTORE_FILE
 *   DIETINATOR_KEYSTORE_PASSWORD
 *   DIETINATOR_KEY_ALIAS
 *   DIETINATOR_KEY_PASSWORD
 *
 * Secrets come from GitHub Actions secrets, never from the repo.
 */
const fs = require("fs")

const GRADLE_PATH = "android/app/build.gradle"

if (!fs.existsSync(GRADLE_PATH)) {
  console.error(`Missing ${GRADLE_PATH} — run \`npx expo prebuild --platform android\` first.`)
  process.exit(1)
}

let source = fs.readFileSync(GRADLE_PATH, "utf8")

const signingBlock = `
        release {
            storeFile file(System.getenv('DIETINATOR_KEYSTORE_FILE'))
            storePassword System.getenv('DIETINATOR_KEYSTORE_PASSWORD')
            keyAlias System.getenv('DIETINATOR_KEY_ALIAS')
            keyPassword System.getenv('DIETINATOR_KEY_PASSWORD')
        }`

const marker = "signingConfigs {"
const markerIndex = source.indexOf(marker)
if (markerIndex === -1) {
  console.error("signingConfigs block not found in build.gradle")
  process.exit(1)
}
source =
  source.slice(0, markerIndex + marker.length) +
  "\n" +
  signingBlock +
  source.slice(markerIndex + marker.length)

const buildTypesIndex = source.indexOf("buildTypes {")
const releaseIndex = source.indexOf("release {", buildTypesIndex)
const debugSignature = "signingConfig signingConfigs.debug"
const signatureIndex = source.indexOf(debugSignature, releaseIndex)
if (buildTypesIndex === -1 || releaseIndex === -1 || signatureIndex === -1) {
  console.error("release buildType signingConfig not found in build.gradle")
  process.exit(1)
}
source =
  source.slice(0, signatureIndex) +
  "signingConfig signingConfigs.release" +
  source.slice(signatureIndex + debugSignature.length)

fs.writeFileSync(GRADLE_PATH, source)
console.log("release signing config wired in android/app/build.gradle")
