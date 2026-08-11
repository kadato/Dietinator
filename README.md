# Dietinator

<div align="center">

[![CI](https://img.shields.io/github/actions/workflow/status/tothKarolyDavid/Dietinator/ci.yml?label=CI&logo=github)](https://github.com/tothKarolyDavid/Dietinator/actions)
[![Android APK](https://img.shields.io/badge/Android-latest%20APK-3ddc84?logo=android&logoColor=white)](https://github.com/tothKarolyDavid/Dietinator/releases/latest/download/Dietinator-Android.apk)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Expo SDK 56](https://img.shields.io/badge/Expo-SDK%2056-000020?logo=expo&logoColor=white)](https://expo.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A calorie tracker that works **offline first**. Your diary lives in
local SQLite, food search comes from the YAZIO food database, and sync back to
your account is optional and best-effort. No account needed to try it.

</div>

> **Try it:** build the web app and open `/?demo=1`, or tap **Explore the demo**
> on the login screen. A full demo session seeds itself, no account required.

## Download

**Android.** Install the latest signed build directly:

<div align="center">

[![Download Dietinator for Android](https://img.shields.io/badge/Download-Dietinator%20Android%20APK-0d9488?style=for-the-badge&logo=android&logoColor=white)](https://github.com/tothKarolyDavid/Dietinator/releases/latest/download/Dietinator-Android.apk)

</div>

- The link always points at the newest release. Every tag push rebuilds and
  re-attaches the signed APK via `.github/workflows/release.yml`.
- On first install, allow **Install unknown apps** for your browser when prompted.
- The app checks GitHub for newer versions on startup from the Settings screen
  and offers a one-tap download when one is out. Updates never touch your local diary.

## Preview

<div align="center">

<p align="center">
<strong>Diary</strong> · <strong>AI assistant</strong> · <strong>Food search</strong><br><br>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/dashboard-dark.png">
  <img alt="Daily dashboard with calorie ring, meals and weight logging" src="./docs/screenshots/dashboard-light.png" width="190">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/ai-chat-dark.png">
  <img alt="AI assistant with one-tap presets" src="./docs/screenshots/ai-chat-light.png" width="190">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/search-dark.png">
  <img alt="Food search with recent picks kept visible" src="./docs/screenshots/search-light.png" width="190">
</picture>
</p>

<p align="center">
<strong>Log a food</strong> · <strong>Quick Add</strong> · <strong>Meal builder</strong><br><br>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/add-food-dark.png">
  <img alt="Serving sizes, amount stepper and nutrition preview" src="./docs/screenshots/add-food-light.png" width="190">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/quick-add-dark.png">
  <img alt="Quick Add with calorie and macro steppers" src="./docs/screenshots/quick-add-light.png" width="190">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/meal-builder-dark.png">
  <img alt="Compose reusable meals with amount steppers" src="./docs/screenshots/meal-builder-light.png" width="190">
</picture>
</p>

<p align="center">
<strong>Diary details</strong> · <strong>Settings</strong> · <strong>Login</strong><br><br>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/log-meal-dark.png">
  <img alt="Already logged entries with edit and delete" src="./docs/screenshots/log-meal-light.png" width="190">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/settings-dark.png">
  <img alt="Daily goals with quick-adjust steppers" src="./docs/screenshots/settings-light.png" width="190">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/login-dark.png">
  <img alt="Login screen with demo mode" src="./docs/screenshots/login-light.png" width="190">
</picture>
</p>

</div>

## Features

- **Local-first diary.** Instant logging to SQLite, fully offline, cached foods included.
- **Daily dashboard.** Calorie ring, macro goals, color-coded meal sections, weight
  logging right from the weight row, floating action buttons on phones.
- **Food search.** Debounced YAZIO search, cached in SQLite, with favorites and
  recents that stay visible while you type and a one-tap clear button.
- **Serving sizes.** Named portions such as cup, whole or each are one tap away,
  and the amount you logged last time is prefilled.
- **Numeric steppers.** Every number field has minus and plus buttons, and holding
  a button repeats the step for fast changes.
- **Barcode scanning.** EAN/UPC camera scan on device, manual entry on web.
- **Meals and Quick Add.** Save food combinations, log calories without searching.
- **Logging overview.** The logging screen shows what is already logged for the
  day, with edit and delete right there.
- **AI assistant.** In-app chat with your diary using any OpenAI-compatible
  provider, OpenAI, OpenRouter, Ollama and more. Streaming answers, on-device
  tools for diary, goals and food search, destructive actions need your approval,
  history survives restarts.
- **Agent API, MCP.** The web build exposes the diary snapshot and goals to
  external AI agents such as Claude Desktop or Cursor over the Model Context
  Protocol at `/mcp`.
- **Backup and export.** Full JSON backup and restore, JSON and CSV export.
- **Demo mode.** Explore everything without an account.
- **Light and dark themes.** Adaptive, responsive layouts from phone to desktop.

## Tech stack

| Area      | Choice                                                                         |
| --------- | ------------------------------------------------------------------------------ |
| Framework | Expo SDK 56 · React Native · expo-router                                       |
| Database  | expo-sqlite, WAL journal mode, migrations in `src/db/database.ts`              |
| UI        | gluestack-ui v3 + NativeWind v4                                                |
| Sync      | unofficial `yazio` npm client, `withRetry`, offline-first                      |
| AI chat   | OpenAI-compatible streaming client under `src/services/ai/`, tools over SQLite |
| Agent API | MCP server in `scripts/mcp-server.cjs`, served by Metro and `serve:web`        |
| Auth/data | expo-secure-store, React Context                                               |
| Tests     | Jest unit tests · Playwright e2e on the web build                              |
| Quality   | TypeScript strict, ESLint, Prettier, husky, coverage gates, gitleaks           |

## Getting started

```bash
nvm use            # Node 22 (.nvmrc)
npm install
npm start          # Metro: scan the QR with Expo Go
npm run web        # or run in the browser
```

Useful: `npm run test:coverage` · `npm run test:e2e` · `npm run build:web` ·
`npm run typecheck` · `npm run lint`

## Testing & CI

Jest unit tests cover the pure logic: date math, nutrient conversions, retry
policy, backup round-trip, DB migrations, AI streaming and tools, MCP server
and agent bridge. Playwright e2e drives the web build at phone dimensions
through boot, demo mode, diary CRUD, offline search, backup and restore, and
the AI chat surface. CI runs typecheck, lint, format, coverage, e2e and a
secret scan on every push.

## AI assistant & Agent API (MCP)

### In-app chat

Enable **AI Assistant** in Settings and pick a provider preset: OpenAI,
OpenRouter, OpenCode, Ollama, or any OpenAI-compatible API. The preset fills
the base URL and a default model. Add your API key. It is stored in the device
keystore, with prefixed localStorage on web, and only ever sent to the provider
you configured. Use **Fetch models** to list available models or **Test
connection** to verify the endpoint. The assistant can read your diary, look up
foods, log entries, manage meals and update goals using on-device tools.
Destructive actions show an Approve or Decline card first. The chat opens with
one-tap presets for a daily review, protein check, dinner plan, week in review,
snack log and goal reset. History lives in SQLite so it survives restarts.

### Agent API (`/mcp`)

The web host, Metro dev server or `npm run serve:web`, mounts a stateless
Model Context Protocol server at `/mcp` plus a same-origin snapshot bridge at
`/api/agent/*`:

1. The web app pushes a snapshot of the last 14 diary days, goals and meals on
   boot and after every diary change. The snapshot is in-memory only, nothing
   touches disk.
2. Any MCP client, such as Claude Desktop, Cursor or MCP Inspector, connects to
   `http://localhost:8082/mcp` and gets these tools:
   `get_diary`, `get_diary_stats`, `get_goals`, `get_settings`, `get_meals`,
   `log_food`, `update_food_entry`, `delete_food_entry`, `set_goals`,
   `set_units`, `log_meal`. Write tools mirror their changes into the
   snapshot, so multi-step agent flows like log, update and delete work.
3. Agent changes are queued as a revisioned change log. The app pulls and
   applies them into SQLite on the next dashboard focus.

Protect the endpoint with an API key: `MCP_API_KEY=… npm run serve:web`.
Clients send `X-Api-Key` or `Authorization: Bearer`. In production mode the
key is mandatory. Optional browser-based MCP clients can be allowed with
`MCP_CORS_ORIGINS=…`.

Live-check the whole surface with a real model:
`OPENCODE_API_KEY=sk-… npm run test:mcp`. It boots `/mcp`, drives an agent
loop through every tool, and validates the change feed.

## More

- [ARCHITECTURE.md](ARCHITECTURE.md) covers the data model, local-first flow
  and release pipeline.
- [CHANGELOG.md](CHANGELOG.md) holds the version history, and `npm run release`
  cuts a new one.
- Releases build a signed Android APK via `.github/workflows/release.yml`.
  See [Download](#download) for the latest APK and how in-app updates work.

> **Note:** this app uses a reverse-engineered, unofficial YAZIO API. Personal
> use only, it may break without notice. The local-first design keeps the app
> fully usable when it does.
