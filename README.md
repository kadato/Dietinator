# Dietinator

<div align="center">

[![CI](https://img.shields.io/github/actions/workflow/status/kadato/Dietinator/ci.yml?label=CI&logo=github)](https://github.com/kadato/Dietinator/actions)
[![Android APK](https://img.shields.io/badge/Android-latest%20APK-3ddc84?logo=android&logoColor=white)](https://github.com/kadato/Dietinator/releases/latest/download/Dietinator-Android.apk)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Expo SDK 57](https://img.shields.io/badge/Expo-SDK%2057-000020?logo=expo&logoColor=white)](https://expo.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Dietinator is a local-first calorie tracker. Diary entries live in SQLite on your device. Food search and optional sync use the unofficial YAZIO API. You need no account. The diary works offline.

</div>

<div align="center">

[![Live Demo - Try in browser](https://img.shields.io/badge/Live%20Demo-Try%20in%20browser-2dd4bf?style=for-the-badge)](https://dietinator.pages.dev/?demo=1)

No install, no account. Tap **Explore the demo** on the login screen.

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
  <img alt="Food search with category icons, recents, and one-tap favorites" src="./docs/screenshots/search-light.png" width="190">
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

- **Local-first diary.** The app writes to `diary_entries` in `expo-sqlite` with WAL. The diary works fully offline. The food cache keeps past searches.
- **Dashboard.** The dashboard shows a calorie ring, macro bars, and meal sections. It supports water and weight quick-add, copy of the previous day, and pull to refresh from YAZIO when you are online.
- **Food search.** The search debounces YAZIO lookups. It shows category icons, favorites, and recents. It remembers serving sizes and amounts. Steppers support hold repeat. You see live budget impact before you save.
- **Meals.** The builder stores reusable combos with auto nutrition math. Quick Add stores direct kcal and macros. Each meal has a budget and inline entry edit.
- **Barcode.** The camera scans EAN and UPC on device with cache lookup. The scan is limited on web.
- **Weight and water.** You log water with presets. You track weight with BMI and trend charts.
- **Micronutrients.** The dashboard and food detail show fiber, sugar, saturated fat, sodium, potassium, calcium, and iron.
- **AI assistant.** Turn it on in Settings. It supports OpenAI, OpenRouter, Ollama, and any OpenAI-compatible endpoint. It streams answers. It runs tools against your local SQLite. It asks before destructive writes. It keeps history in SQLite. Read [Dietinator architecture](ARCHITECTURE.md) for the MCP endpoint at `/mcp`.
- **Backup and export.** Export JSON or CSV. Back up and restore the full SQLite file. You start every export and restore.
- **Demo mode.** `/?demo=1` loads sample data. You need no account. Themes follow the system, or you pick light or dark manually.

## Tech stack

| Area      | Choice                                                              |
| --------- | ------------------------------------------------------------------- |
| Runtime   | Node 22, see `.nvmrc`, `packageManager` is `pnpm@11.22.0`           |
| Framework | Expo SDK 57, React 19.2, React Native 0.86, `expo-router` in `app/` |
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

The start script uses port `9082`. Port `9082` avoids Windows Hyper-V collisions on `8081`. To use another port, run `pnpm start -- --port 9090`.

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

- [Dietinator architecture](ARCHITECTURE.md). Data model, local-first flow, release pipeline and the MCP bridge.
- [Changelog](CHANGELOG.md). Version history. `pnpm run release` tags `vX.Y.Z`.
- [Contributing](CONTRIBUTING.md). Ground rules and quality gates.

> **Note.** Dietinator uses an unofficial, reverse-engineered YAZIO API. Use Dietinator for yourself only. The API can change without notice. The local-first design keeps the diary and cache working when the API changes.
