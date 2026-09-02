// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config")
const expoConfig = require("eslint-config-expo/flat")
const globals = require("globals")

module.exports = defineConfig([
  expoConfig,
  {
    files: ["scripts/**/*.{js,cjs,mjs}"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["scripts/__tests__/**/*.test.js"],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },
  {
    ignores: [
      "dist/*",
      "android/*",
      "node_modules/*",
      ".expo/*",
      "playwright-report/*",
      "test-results/*",
      "public/worker.js",
      "public/*.wasm",
    ],
  },
])
