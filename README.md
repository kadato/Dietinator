# Dietinator

Fast, ad-free calorie tracker for personal use. Logs meals locally in SQLite and searches YAZIO's food database via the unofficial [yazio](https://www.npmjs.com/package/yazio) npm client.

## Features

- Local-first diary (instant logging, works offline for cached foods)
- YAZIO food search with debounce and SQLite cache
- Barcode scanning (EAN/UPC) with cache-first lookup
- Daily calorie and macro dashboard
- Favorites and recent foods
- Optional best-effort sync to your YAZIO account
- Export diary as JSON or CSV
- No ads, no analytics SDKs

## Requirements

- **Node.js 20.19.4+** (Expo SDK 56). Use `nvm use` (reads `.nvmrc`, Node 22 LTS).
- Expo Go or a development build (camera barcode scanning needs a device)
- A YAZIO account

## Setup

```bash
cd Dietinator
npm install
npm start
```

Scan the QR code with Expo Go, or run `npm run android` / `npm run ios`.

For **web** in the browser: `npm run web` (needs `react-native-web` and `react-dom`, installed with the rest of the deps). YAZIO API calls are proxied through Metro at `/api/yazio` during development so the browser is not blocked by CORS on `yzapi.yazio.com`.

> **Why not Vite?** Expo SDK 56 removed Vite support (since SDK 52 the only web bundler is Metro). The fastest supported loops are `npm run dev:web` (hot reload) and `npm run test:e2e:dev` (Playwright against the dev server).

## Commands

| Command | What it does |
|---|---|
| `npm start` / `npm run dev` | Metro dev server (native + web) |
| `npm run dev:web` | Metro dev server for the browser, hot reload |
| `npm run typecheck` | `tsc --noEmit` over the whole project |
| `npm run build:web` | Production web export to `dist/` |
| `npm run serve:web` | Serve `dist/` locally (COEP/COOP headers + YAZIO proxy, gzip). Requires a prior `build:web` |
| `npm run web:prod` | Build + serve in one shot |
| `npm run test:e2e` | Build web + run Playwright (phone viewport, offline/local-first flows) |
| `npm run test:e2e:headed` | Same, with a visible browser |
| `npm run test:e2e:dev` | Playwright against a running `npm run dev:web` (fast iteration, no rebuild) |
| `npm run test:e2e:yazio` | Real-account suite (skips unless `.env.local` has credentials) |
| `npm run test:e2e:install` | Download the Chromium test browser |

### E2E tests

Tests live in `e2e/` and run against the **web build at phone dimensions** (390×844). They seed a fake local session (`calorie_tracker_yazio_logged_in` in localStorage) so the whole diary works offline — no YAZIO credentials needed. YAZIO stays unreachable in tests, which exercises the local-first path.

```bash
npm run test:e2e          # deterministic: build + serve + test (offline suites)
npm run test:e2e:dev      # fast loop against your dev server (start `npm run dev:web` once)
```

**Real-account YAZIO tests** (`e2e/yazio.spec.ts`) sign in with your actual YAZIO credentials and exercise live search, logging, sync, and delete. They only run when `.env.local` contains credentials — the file is gitignored and never committed:

```bash
# .env.local  (never commit)
YAZIO_EMAIL=you@example.com
YAZIO_PASSWORD=your-password

npm run test:e2e:yazio
```

These tests create one consumed item on the real YAZIO account and delete it again afterwards.

Playwright's MCP server is configured for AI agents in `.opencode/opencode.json` — it lets an agent drive the browser, screenshot the app, and iterate on UI without hand-written selectors.

## Reproducible dev environment (recommended)

Local Node version mismatches (wrong `node` on PATH, old npm `node` package, peer dependency errors) are the usual cause of Metro/Babel failures. Pin the toolchain instead of relying on whatever is installed globally.

### Dev Container (best default in Cursor/VS Code)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and the **Dev Containers** extension.
2. Command palette → **Dev Containers: Reopen in Container**.
3. Inside the container: `npm start` or `npm run web`.

The container uses **Node 22** from `.devcontainer/devcontainer.json` and runs `npm ci` on create. Expo/Metro ports are forwarded automatically.

### Docker Compose (web-only)

Useful when you only want the browser bundle with a fixed Node image:

```bash
docker compose up --build
```

Then open the URL Metro prints (typically `http://localhost:8081` or `8082`).

**Note:** Expo Go on a physical phone still needs Metro reachable on your LAN. Run `npm start` on the **host** (or use tunnel mode) for mobile; use the container mainly for **web** and for consistent `npm install` / CI.

### Local Node (without Docker)

```bash
nvm use          # Node 22 from .nvmrc
node -v          # must be >= 20.19.4
npm install
npm start
```

Do **not** install the npm package named `node` in your home directory — it is not the Node.js runtime and will break Expo.

## Important

This app uses a **reverse-engineered, unofficial** YAZIO API. It may break without notice and is intended for **personal use only**. Your YAZIO credentials are stored in the device secure store.

## Project structure

- `app/` — Expo Router screens
- `src/db/` — SQLite schema and queries
- `src/services/yazio/` — YAZIO API wrapper
- `src/components/` — UI components

## Releasing a new version (Android)

Releases are published from GitHub by tagging the repository. The
`.github/workflows/release.yml` pipeline runs on every `v*` tag:

1. **Tests** - typecheck and the offline/local-first e2e suite (YAZIO specs skip without credentials).
2. **Signed APK** - `expo prebuild` + a production Gradle build, signed with your release keystore.
3. **Release** - a GitHub release with the `Dietinator-Android.apk` asset and a changelog generated
   from conventional commits (`feat:`, `fix:`) since the previous tag. The app shows that changelog
   (markdown) in the in-app update dialog.

### One-time setup: signing keystore

Create a keystore (keep it forever - the app updates must keep the same signature):

```bash
keytool -genkeypair -v -keystore dietinator-release.keystore -alias dietinator \
  -keyalg RSA -keysize 2048 -validity 10000
```

Add these repository secrets (Actions > Settings > Secrets):

| Secret | Value |
|--------|-------|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 dietinator-release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | `dietinator` |
| `ANDROID_KEY_PASSWORD` | Key password |

### Publishing a release

1. Bump the version in `app.json` (`version`, and `android.versionCode`) - or let the pipeline
   derive both from the tag (`v1.1.0` -> version `1.1.0`, versionCode `10100`).
2. Commit and push a tag:

```bash
git tag v1.1.0
git push origin v1.1.0
```

3. The workflow builds the APK, creates the release with auto-generated changelog notes, and the
   Android app prompts with the update dialog on next start (Settings > Updates to disable).

For a manual trigger without a tag, run the workflow from the Actions tab and provide the version.

### How the in-app updater works

- On Android, the app silently checks GitHub's latest release 4 seconds after startup
  (once per session). If the release tag is newer than the installed version, an update dialog
  shows the changelog (markdown-rendered) with **Download** (opens the signed APK in the browser),
  **Later**, and **Don't ask again** (disables the startup check in Settings > Updates).
- Check for updates manually at any time from Settings > Updates.
