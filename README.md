# Dietinator

<div align="center">

[![CI](https://img.shields.io/github/actions/workflow/status/kadato/Dietinator/ci.yml?label=CI&logo=github)](https://github.com/kadato/Dietinator/actions)
[![Android APK](https://img.shields.io/badge/Android-latest%20APK-3ddc84?logo=android&logoColor=white)](https://github.com/kadato/Dietinator/releases/latest/download/Dietinator-Android.apk)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Expo SDK 56](https://img.shields.io/badge/Expo-SDK%2056-000020?logo=expo&logoColor=white)](https://expo.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Dietinator is a local-first calorie tracker. Diary entries live in SQLite on your device. Food search and optional sync use the YAZIO database. No account needed. Works offline.

</div>

<div align="center">

[![Live Demo — Try in browser](https://img.shields.io/badge/Live%20Demo-Try%20in%20browser-2dd4bf?style=for-the-badge)](https://dietinator.pages.dev/?demo=1)

No install, no account. Or tap **Explore the demo** on the login screen.

</div>

## Download

**Android.** Install the latest signed APK:

<div align="center">

[![Download Dietinator for Android](https://img.shields.io/badge/Download-Dietinator%20Android%20APK-0d9488?style=for-the-badge&logo=android&logoColor=white)](https://github.com/kadato/Dietinator/releases/latest/download/Dietinator-Android.apk)

</div>

Every `v*` tag builds a signed APK via `.github/workflows/release.yml`. On first install, allow **Install unknown apps** for your browser. Updates keep your local SQLite data. The app checks GitHub releases on start and shows an update prompt in Settings.

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

- **Local-first diary.** Writes to `diary_entries` in `expo-sqlite` with WAL. Works fully offline. Food cache keeps past searches.
- **Dashboard.** Calorie ring, macro bars, meal sections, water and weight quick-add, copy previous day, pull to refresh from YAZIO when online.
- **Food search.** Debounced YAZIO lookup, category icons, favorites and recents, serving sizes with remembered amounts, amount steppers with hold repeat, live budget impact before you save.
- **Meals.** Builder for reusable combos with auto nutrition math, plus Quick Add for direct kcal and macros. Per-meal budgets and inline entry edit.
- **Barcode.** Camera scan for EAN and UPC on device with cache lookup. Limited on web.
- **Weight and water.** Log water with presets, track weight with BMI and trend charts.
- **Micronutrients.** Fiber, sugar, saturated fat, sodium, potassium, calcium, iron on the dashboard and food detail.
- **AI assistant.** Optional, in Settings. Supports OpenAI, OpenRouter, Ollama and any OpenAI-compatible endpoint. Streams answers, runs tools against your local SQLite, asks before destructive writes, keeps history in SQLite. See [ARCHITECTURE.md](ARCHITECTURE.md) for the MCP endpoint at `/mcp`.
- **Backup and export.** JSON or CSV export, full SQLite backup and restore. All user initiated.
- **Demo mode.** `/?demo=1` loads sample data, no account. Light and dark themes, system or manual.

## Tech stack

| Area      | Choice                                                              |
| --------- | ------------------------------------------------------------------- |
| Runtime   | Node 22, see `.nvmrc`, `packageManager` is `pnpm@11.22.0`           |
| Framework | Expo SDK 56, React 19.2, React Native 0.85, `expo-router` in `app/` |
| DB        | `expo-sqlite` WAL, migrations in `src/db/database.ts`               |
| UI        | `gluestack-ui` v3 and `NativeWind` v4, `global.css`                 |
| Sync      | `yazio` npm client, `withRetry` on 5xx and 429, offline-first       |
| Tests     | Jest and jest-expo, Playwright on the web build                     |

## Get started

```bash
nvm use            # 22, see .nvmrc
pnpm install
pnpm start         # Metro on port 9082, scan QR with Expo Go
pnpm run web       # or run in the browser
```

Port `9082` avoids Windows Hyper-V collisions on `8081`. To use another port, run `pnpm start -- --port 9090`.

Other commands:

```bash
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm test
pnpm run test:e2e  # builds dist/ and runs Playwright at phone size
pnpm run build:web # writes dist/
```

## More

- [ARCHITECTURE.md](ARCHITECTURE.md) - data model, local-first flow, release pipeline and the MCP bridge
- [CHANGELOG.md](CHANGELOG.md) - version history. `pnpm run release` tags `vX.Y.Z`
- [CONTRIBUTING.md](CONTRIBUTING.md) - ground rules and quality gates

> **Note.** Dietinator uses an unofficial, reverse-engineered YAZIO API. Use it for yourself only. The API can change without notice. The local-first design keeps the diary and cache working when it does.
