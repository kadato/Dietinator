# Dietinator

<div align="center">

[![CI](https://img.shields.io/github/actions/workflow/status/kadato/Dietinator/ci.yml?label=CI&logo=github)](https://github.com/kadato/Dietinator/actions)
[![Android APK](https://img.shields.io/badge/Android-latest%20APK-3ddc84?logo=android&logoColor=white)](https://github.com/kadato/Dietinator/releases/latest/download/Dietinator-Android.apk)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Expo SDK 56](https://img.shields.io/badge/Expo-SDK%2056-000020?logo=expo&logoColor=white)](https://expo.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A local-first calorie tracker. Diary entries live in on-device SQLite, food search uses the YAZIO database, and sync back to your account is optional and best-effort. No account required.

</div>

> **Try it:** Open `/?demo=1` or tap **Explore the demo** on the login screen to seed a local session without an account.

## Download

**Android.** Install the latest signed build directly:

<div align="center">

[![Download Dietinator for Android](https://img.shields.io/badge/Download-Dietinator%20Android%20APK-0d9488?style=for-the-badge&logo=android&logoColor=white)](https://github.com/kadato/Dietinator/releases/latest/download/Dietinator-Android.apk)

</div>

- The link points to the latest release. Every tagged release triggers a signed APK build via `.github/workflows/release.yml`.
- On first install, enable **Install unknown apps** for your browser when prompted.
- The app checks for new GitHub releases on startup and displays an update prompt in Settings. Updates preserve local SQLite data.

## Preview

<div align="center">

<p align="center">
<strong>Daily dashboard</strong>, <strong>Stats and trends</strong>, <strong>AI assistant</strong><br><br>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/dashboard-dark.png">
  <img alt="Daily dashboard with calorie ring, macro progress, meal breakdown and water tracking" src="./docs/screenshots/dashboard-light.png" width="190">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/stats-dark.png">
  <img alt="Consistency streaks, weight trends with BMI and goal progress, calorie history, and macro split" src="./docs/screenshots/stats-light.png" width="190">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/ai-chat-dark.png">
  <img alt="AI assistant with on-device tools and one-tap presets" src="./docs/screenshots/ai-chat-light.png" width="190">
</picture>
</p>

<p align="center">
<strong>Food search and favorites</strong>, <strong>Food and portion details</strong>, <strong>Meal builder</strong><br><br>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/search-dark.png">
  <img alt="Food search with dynamic icons, recents, and one-tap favorites" src="./docs/screenshots/search-light.png" width="190">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/add-food-dark.png">
  <img alt="Serving sizes, amount steppers and live daily budget impact" src="./docs/screenshots/add-food-light.png" width="190">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/meal-builder-dark.png">
  <img alt="Compose reusable meals with amount steppers and nutrition facts" src="./docs/screenshots/meal-builder-light.png" width="190">
</picture>
</p>

<p align="center">
<strong>Meal slot tracking</strong> and <strong>Goals and settings</strong><br><br>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/log-meal-dark.png">
  <img alt="Meal slot budget overview and logged entries with quick edit" src="./docs/screenshots/log-meal-light.png" width="190">
</picture>
&nbsp;&nbsp;
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/screenshots/settings-dark.png">
  <img alt="Daily goals and nutrition settings with quick-adjust steppers" src="./docs/screenshots/settings-light.png" width="190">
</picture>
</p>

</div>

## Features

- **Local-first diary.** Immediate writes to on-device SQLite with WAL mode. Operates fully offline with local food caching.
- **Daily dashboard.** Calorie ring, macronutrient budget bars, meal sections, hydration logging, body weight tracking, and a "Copy previous day" action.
- **Live daily budget impact.** Real-time recalculation of remaining calories, macronutrients, and daily goals before confirming a food entry.
- **Micronutrient tracking.** Breakdown of vitamins and minerals (fiber, sugar, saturated fat, sodium, potassium, calcium, iron) from the dashboard and food detail views.
- **Food search and category icons.** Debounced search with multilingual food category icons, pinned favorites, recent items, and SQLite caching.
- **Serving sizes and portions.** Named portions (cup, whole, piece) and gram amounts with prefilled quantities from previous logs.
- **Numeric steppers.** Increment and decrement controls on numeric fields with press-and-hold repeat.
- **Meal builder and Quick Add.** Save reusable food combinations with automatic nutrition aggregation, or log calories and macros directly.
- **Meal slot budgets.** Real-time meal budget tracking, daily totals, quick-add actions, and inline entry editing.
- **Barcode scanning.** Camera-based EAN/UPC barcode scanner on mobile devices with local cache lookup.
- **Hydration and weight tracking.** Log water intake with presets (+250 ml) and record body weight with BMI calculation and trend charts.
- **AI assistant.** In-app assistant supporting OpenAI, OpenRouter, Ollama, and custom OpenAI-compatible endpoints. It streams responses, runs on-device SQLite tools, asks for confirmation before destructive actions, and keeps history in SQLite.
- **Agent API (MCP).** Model Context Protocol endpoint at `/mcp` exposing real-time diary snapshots and tool execution to external agents (Claude Desktop, Cursor).
- **Backup, export, and restore.** Export diary entries to CSV or JSON, with on-device SQLite database backup and restore.
- **In-app updates (Android).** Automatic GitHub release checks on startup with background APK download and direct package installation.
- **Demo mode.** Instant session with populated sample data, no account required.
- **Light and dark themes.** System theme detection, manual override, and responsive layouts across mobile and desktop.

## Tech stack

| Area      | Choice                                                                         |
| --------- | ------------------------------------------------------------------------------ |
| Framework | Expo SDK 56, React Native, expo-router                                         |
| Database  | expo-sqlite, WAL journal mode, migrations in `src/db/database.ts`              |
| UI        | gluestack-ui v3 + NativeWind v4                                                |
| Sync      | unofficial `yazio` npm client, `withRetry`, offline-first                      |
| AI chat   | OpenAI-compatible streaming client under `src/services/ai/`, tools over SQLite |
| Agent API | MCP server in `scripts/mcp-server.cjs`, served by Metro and `serve:web`        |
| Updates   | expo-intent-launcher, GitHub releases pipeline                                 |
| Auth/data | expo-secure-store, React Context                                               |
| Tests     | Jest unit tests, Playwright e2e on the web build                               |
| Quality   | TypeScript strict, ESLint, Prettier, husky, coverage gates, gitleaks           |

## Getting started

```bash
nvm use            # Node 22 (.nvmrc)
npm install
npm start          # Metro: scan the QR with Expo Go
npm run web        # or run in the browser
```

Development scripts pin port **9082** (`--port 9082`) to avoid Windows Hyper-V reserved port collisions on 8081. To use a different port: `npm start -- --port 9090`.

Useful: `npm run test:coverage`, `npm run test:e2e`, `npm run build:web`,
`npm run typecheck`, `npm run lint`

## Testing and CI

Jest unit tests cover the pure logic: date math, nutrient conversions, retry
policy, backup round-trip, DB migrations, AI streaming and tools, MCP server
and agent bridge. Playwright e2e drives the web build at phone dimensions
through boot, demo mode, diary CRUD, offline search, backup and restore, and
the AI chat surface. CI runs typecheck, lint, format, coverage, e2e and a
secret scan on every push.

## AI assistant and Agent API (MCP)

### In-app chat

Enable **AI Assistant** in Settings and select a provider preset: OpenAI,
OpenRouter, OpenCode, Ollama, or a custom OpenAI-compatible endpoint. The preset
fills the base URL and a default model. Enter an API key. Keys are stored in the
device keystore (prefixed `localStorage` on web) and transmitted only to the
configured provider endpoint. Use **Fetch models** to query supported models or
**Test connection** to validate the endpoint.

The assistant reads the local diary, queries foods, logs entries, manages meals,
and updates goals via on-device tools. Destructive operations require confirmation
before execution. Built-in prompts include daily reviews, protein checks, meal
plans, and goal adjustments. Conversation history is persisted in SQLite across
app restarts.

### Agent API (`/mcp`)

The web host, Metro dev server or `npm run serve:web`, mounts a stateless
Model Context Protocol server at `/mcp` plus a same-origin snapshot bridge at
`/api/agent/*`:

1. The web app pushes a snapshot of the last 14 diary days, goals, water, weight, meals,
   and favorites on boot and after every data change. The snapshot lives in memory only.
   Nothing touches disk.
2. Any MCP client, such as Claude Desktop, Cursor, or MCP Inspector, connects to
   `http://localhost:9082/mcp` (the default dev/serve port) and exposes these tools:
   `get_diary`, `get_diary_stats`, `get_water`, `get_weight`, `get_meals`,
   `get_favorite_foods`, `get_goals`, `get_settings`, `get_health_summary`,
   `log_food`, `log_water`, `log_weight`, `log_meal`, `save_meal`,
   `update_food_entry`, `delete_food_entry`, `delete_water`, `delete_weight`,
   `delete_meal`, `toggle_favorite`, `set_goals`, `set_units`, `set_profile`.
   Write tools mirror changes into the memory snapshot immediately, so multi-step
   agent workflows can reference recent updates without re-fetching.
3. The endpoint queues agent changes as a revisioned change log. The app pulls
   and applies them into SQLite on the next dashboard focus.

Protect the endpoint with an API key: `MCP_API_KEY=… npm run serve:web`.
Clients send `X-Api-Key` or `Authorization: Bearer`. In production mode the
key is mandatory. Browser-based MCP clients can be permitted via
`MCP_CORS_ORIGINS=…`.

Validate the MCP integration with a model:
`OPENCODE_API_KEY=sk-… npm run test:mcp`. This command boots `/mcp`, executes an
agent loop across all tools, and verifies the change log.

## More

- [ARCHITECTURE.md](ARCHITECTURE.md) covers the data model, local-first flow
  and release pipeline.
- [CHANGELOG.md](CHANGELOG.md) documents version history. `npm run release`
  automates tagging.
- Releases build a signed Android APK via `.github/workflows/release.yml`.
  See [Download](#download) for APK installation and in-app update details.

> **Note:** Dietinator uses an unofficial, reverse-engineered YAZIO API. For personal
> use only. The API may change or become unavailable without notice; local-first
> architecture ensures all offline features remain functional.
