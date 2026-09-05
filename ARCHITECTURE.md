# Dietinator architecture

How the app is built and why. Short version: local-first diary, optional
best-effort YAZIO sync, everything on-device.

## Big picture

```mermaid
flowchart LR
    subgraph UI["app/ (expo-router)"]
        Login
        Dashboard
        Search
        Scan
        Settings
    end

    subgraph Logic["src/services/"]
        Diary["diary.ts"]
        Backup
        Updates
        Yazio["yazio/ client"]
    end

    subgraph Data["src/db/ (expo-sqlite, WAL)"]
        Entries[diary_entries]
        Cache[food_cache]
        Meals
        SettingsTbl[settings]
    end

    UI --> Logic
    Logic --> Data
    Yazio -->|"HTTPS, unofficial API"| YAZIO[(YAZIO)]
    Data -.->|"user-initiated only"| Export[JSON or CSV export]

    style YAZIO stroke-dasharray: 4 2
```

## Layering rules

- `app` screens compose UI and call `src/services`. Route files include no SQL or YAZIO calls.
- `src/services` own business logic and orchestrate `src/db`.
- `src/db` own the SQLite schema, queries, and JSON mapping. DB row shapes
  align with interfaces in `src/types/index.ts`. The service boundary parses
  JSON columns `nutrients_json` and `serving_json`.
- `src/utils` are pure, unit-tested helpers for date, nutrients, units, retry,
  and barcode.

## Local-first diary flow

1. The user logs food. The app writes the `diary_entries` row immediately.
   Logging needs no network round-trip.
2. When `yazio_sync_enabled` is on in settings, `syncEntryToYazio` and
   `syncPendingEntries` in `src/services/yazio/sync.ts` push the row best-effort.
3. YAZIO failures never block the diary. Entries keep `yazio_synced = 0` and
   sync later. Or the UI shows the offline banner and keeps working.

## YAZIO client lifecycle

- Singleton in `src/services/yazio/client.ts` with `initYazioClient`, `getYazioClient`, `loginWithCredentials`, and `logoutYazio`.
- Credentials and tokens live in `src/services/yazio/auth-storage.ts` with expo-secure-store and a prefixed localStorage fallback on web.
- Flaky calls go through `withRetry` in `src/utils/retry.ts`. `withRetry` retries 5xx
  and 429 responses. It skips most other 4xx responses.

## Data model

| Table           | Purpose                                                 | Sync state                      |
| --------------- | ------------------------------------------------------- | ------------------------------- |
| `diary_entries` | Logged meals. Id is `TEXT PRIMARY KEY` from sync layer  | `yazio_synced`, `yazio_item_id` |
| `food_cache`    | YAZIO products, favorites, recents                      | `last_used_at`                  |
| `meals`         | Foods you often eat together                            | None                            |
| `settings`      | Single row `id = 1` with goals and `yazio_sync_enabled` | None                            |

To change the schema, update `migrate` in `src/db/database.ts` only with additive
`IF NOT EXISTS` columns for compatibility.

## Boot sequence

`AppProvider` in `src/context/AppContext.tsx`:

1. `getDatabase` plus migrate
2. `refreshSettings` plus `refreshAuth`
3. When `ready` is true, `app/_layout.tsx` routes to `/login` or `/(tabs)`

## Web specifics

- Metro is the only web bundler in SDK 57 with no Vite.
- The dev server proxies `/api/yazio` to avoid CORS problems with
  `yzapi.yazio.com`. `serve-dist.mjs` does the same for the production export.
  It sends COEP and COOP headers for SQLite-in-WASM isolation.
- SQLite runs in WASM and OPFS on web. Secure-store falls back to prefixed
  localStorage in `src/utils/secure-storage.ts`.

## Release pipeline

- To cut a release, run `pnpm run release` with `major`, `minor`, or `patch`. The script bumps `app.json`
  with version and deterministic versionCode, commits, and tags `vX.Y.Z`.
- Tag push triggers `.github/workflows/release.yml` with typecheck, lint, coverage and an APK build, then a GitHub release with a changelog from conventional commits.
- The Android app checks GitHub releases on start and offers an in-app update with the changelog.
- Web deploys live at [dietinator.pages.dev](https://dietinator.pages.dev). Cloudflare Pages builds `dist` from `main`. The YAZIO proxy lives in `functions/api/yazio/[[path]].js`.
