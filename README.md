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
