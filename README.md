# Dietinator

<div align="center">

[![CI](https://img.shields.io/github/actions/workflow/status/tothKarolyDavid/Dietinator/ci.yml?label=CI&logo=github)](https://github.com/tothKarolyDavid/Dietinator/actions)
[![Android APK](https://img.shields.io/badge/Android-latest%20APK-3ddc84?logo=android&logoColor=white)](https://github.com/tothKarolyDavid/Dietinator/releases/latest/download/Dietinator-Android.apk)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Expo SDK 56](https://img.shields.io/badge/Expo-SDK%2056-000020?logo=expo&logoColor=white)](https://expo.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A fast, ad-free calorie tracker that works **offline first**. Your diary lives in
local SQLite, food search comes from the YAZIO food database, and sync back to
your account is optional and best-effort. No account needed to try it.

</div>

> **Try it:** build the web app and open `/?demo=1` — or tap **Explore the demo**
> on the login screen. A full demo session seeds itself, no account required.

## Download

**Android** — install the latest signed build directly:

<div align="center">

[![Download Dietinator for Android](https://img.shields.io/badge/Download-Dietinator%20Android%20APK-0d9488?style=for-the-badge&logo=android&logoColor=white)](https://github.com/tothKarolyDavid/Dietinator/releases/latest/download/Dietinator-Android.apk)

</div>

- The link always points at the newest release — every tag push rebuilds and
  re-attaches the signed APK via `.github/workflows/release.yml`.
- On first install, allow **Install unknown apps** for your browser when prompted.
- The app checks GitHub for newer versions on startup (Settings → Updates) and
  offers a one-tap download when one is out. Updates never touch your local diary.

## Preview

<div align="center">

<p align="center">
<strong>Diary</strong> · <strong>Food search</strong> · <strong>Log a food</strong><br><br>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/dashboard-dark.png">
  <img alt="Daily dashboard with calorie ring and meal sections" src="./docs/screenshots/dashboard-light.png" width="190">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/search-dark.png">
  <img alt="Live YAZIO food search results" src="./docs/screenshots/search-light.png" width="190">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/add-food-dark.png">
  <img alt="Serving size and nutrition preview" src="./docs/screenshots/add-food-light.png" width="190">
</picture>
</p>

<p align="center">
<strong>Quick Add</strong> · <strong>Meal builder</strong> · <strong>Diary details</strong><br><br>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/quick-add-dark.png">
  <img alt="Quick Add manual entry" src="./docs/screenshots/quick-add-light.png" width="190">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/meal-builder-dark.png">
  <img alt="Compose reusable meals" src="./docs/screenshots/meal-builder-light.png" width="190">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/log-meal-dark.png">
  <img alt="Logged entries with macros" src="./docs/screenshots/log-meal-light.png" width="190">
</picture>
</p>

<p align="center">
<strong>Settings</strong> · <strong>Login</strong><br><br>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/settings-dark.png">
  <img alt="Goals, units and data management" src="./docs/screenshots/settings-light.png" width="190">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/login-dark.png">
  <img alt="Login screen with demo mode" src="./docs/screenshots/login-light.png" width="190">
</picture>
</p>

</div>

## Features

- **Local-first diary** — instant logging to SQLite; works fully offline, cached foods included
- **Daily dashboard** — calorie ring, macro goals, color-coded meal sections, floating action buttons on phones
- **Food search** — debounced YAZIO search, cached in SQLite, favorites + recents
- **Barcode scanning** — EAN/UPC camera scan on device, manual entry on web
- **Meals & Quick Add** — save food combinations, log calories without searching
- **AI assistant** — in-app chat with your diary (OpenAI-compatible: OpenAI, OpenRouter, Ollama…). Streaming answers, on-device tools for diary/goals/food search, destructive actions need your approval, history survives restarts
- **Agent API (MCP)** — the web build exposes the diary snapshot + goals to external AI agents (Claude Desktop, Cursor…) over the Model Context Protocol at `/mcp`
- **Backup & export** — full JSON backup/restore, JSON/CSV export
- **Demo mode** — explore everything without an account
- **Light & dark themes** — adaptive, responsive phone → desktop layouts

## Tech stack

| Area      | Choice                                                                     |
| --------- | -------------------------------------------------------------------------- |
| Framework | Expo SDK 56 · React Native · expo-router                                   |
| Database  | expo-sqlite (WAL), migrations in `src/db/database.ts`                      |
| UI        | gluestack-ui v3 + NativeWind v4                                            |
| Sync      | unofficial `yazio` npm client, `withRetry`, offline-first                  |
| AI chat   | OpenAI-compatible streaming client (`src/services/ai/`), tools over SQLite |
| Agent API | MCP server in `scripts/mcp-server.cjs` (dev Metro + `serve:web`)           |
| Auth/data | expo-secure-store, React Context                                           |
| Tests     | Jest (unit) · Playwright (e2e on the web build)                            |
| Quality   | TypeScript strict, ESLint, Prettier, husky, coverage gates, gitleaks       |

## Getting started

```bash
nvm use            # Node 22 (.nvmrc)
npm install
npm start          # Metro — scan the QR with Expo Go
npm run web        # or run in the browser
```

Useful: `npm run test:coverage` · `npm run test:e2e` · `npm run build:web` ·
`npm run typecheck` · `npm run lint`

## Testing & CI

Jest unit tests cover the pure logic (date math, nutrient conversions, retry
policy, backup round-trip, DB migrations, AI streaming/tools/assistant, MCP
server, agent bridge); Playwright e2e drives the web build at phone dimensions
through boot, demo mode, diary CRUD, offline search, backup/restore and the AI
chat surface. CI runs typecheck, lint, format, coverage, e2e and a secret
scan on every push.

## AI assistant & Agent API (MCP)

### In-app chat

Enable **AI Assistant** in Settings and pick a provider preset (OpenAI, OpenRouter,
OpenCode, Ollama, or any OpenAI-compatible API) — the preset fills the base URL and a
default model. Add your API key (stored in the device keystore, prefixed localStorage
on web; only sent to the provider you configured), then use **Fetch models** to list
available models or **Test connection** to verify the endpoint. The assistant can read
your diary, look up foods, log entries, manage meals and update goals using on-device
tools; destructive actions show an Approve/Decline card first. The chat opens with
**one-tap presets** (daily review, protein check, plan dinner, week in review, log a
snack, reset goals), and history lives in SQLite so it survives restarts.

### Agent API (`/mcp`)

The web host (Metro dev server or `npm run serve:web`) mounts a stateless
Model Context Protocol server at `/mcp` plus a same-origin snapshot bridge
(`/api/agent/*`):

1. The web app pushes a snapshot of the last 14 diary days + goals + meals on boot and
   after every diary change (in-memory only — nothing touches disk).
2. Any MCP client (Claude Desktop, Cursor, MCP Inspector) connects to
   `http://localhost:8082/mcp` and gets the tools:
   `get_diary`, `get_diary_stats`, `get_goals`, `get_settings`, `get_meals`,
   `log_food`, `update_food_entry`, `delete_food_entry`, `set_goals`, `set_units`,
   `log_meal`. Write tools mirror their changes into the snapshot, so multi-step
   agent flows (log → update → delete) work.
3. Agent changes are queued as a revisioned change log; the app pulls and applies
   them into SQLite the next time it syncs (dashboard focus).

Protect the endpoint with an API key: `MCP_API_KEY=… npm run serve:web`
(`X-Api-Key` or `Authorization: Bearer`). In production mode the key is
mandatory. Optional browser-based MCP clients: `MCP_CORS_ORIGINS=…`.

Live-check the whole surface with a real model:
`OPENCODE_API_KEY=sk-… npm run test:mcp` — it boots `/mcp`, drives an agent loop
through every tool, and validates the change feed.

## More

- [ARCHITECTURE.md](ARCHITECTURE.md) — data model, local-first flow, release pipeline
- [CHANGELOG.md](CHANGELOG.md) — version history (`npm run release` cuts a new one)
- Releases build a signed Android APK via `.github/workflows/release.yml` —
  see [Download](#download) for the latest APK and how in-app updates work

> **Note:** uses a reverse-engineered, unofficial YAZIO API — personal use only,
> may break without notice. The local-first design keeps the app fully usable
> when it does.
