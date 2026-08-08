# AGENTS.md — Dietinator

Guidance for AI agents and contributors working on this codebase.

## Project summary

**Dietinator** is a personal, ad-free calorie tracker built with **Expo SDK 56** and **React Native**. It is **local-first**: diary entries live in **SQLite** on device; food search and optional sync use the **unofficial** [`yazio`](https://www.npmjs.com/package/yazio) npm client (reverse-engineered API). No analytics SDKs.

**Constraints agents must respect:**

- Personal use only; do not productize or redistribute YAZIO API access.
- Never commit credentials, tokens, or `.env` secrets.
- Do not add ads, tracking, or third-party analytics.
- YAZIO integration may break without notice — keep offline/local paths working.

## Tech stack

| Area         | Choice                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Runtime      | Node **≥ 20.19.4** (`.nvmrc` → **22 LTS** recommended)                                              |
| Framework    | Expo **~56**, React **19.2**, RN **0.85**                                                           |
| Navigation   | **expo-router** (file-based routes in `app/`)                                                       |
| DB           | **expo-sqlite** (WAL, migrations in `src/db/database.ts`)                                           |
| Auth secrets | **expo-secure-store** (web falls back to prefixed `localStorage` via `src/utils/secure-storage.ts`) |
| Camera       | **expo-camera** (barcode scan — device/dev build, not all web browsers)                             |
| Path alias   | `@/*` → `src/*`; `@ui/*` → `components/ui/*` (`tsconfig.json`)                                      |
| UI           | **gluestack-ui v3** + **NativeWind** v4 (`components/ui/*`, `global.css`)                           |
| TypeScript   | `strict: true`                                                                                      |

Start scripts go through `scripts/expo-cli.cjs` (Node version gate + `polyfill-os.cjs`). Always use `npm start`, not raw `npx expo` unless debugging the wrapper.

## Repository layout

```
app/                    # Expo Router screens (UI routes only)
  _layout.tsx           # Auth gate, Stack, AppProvider
  login.tsx
  (tabs)/               # Main tab navigator
  scan.tsx              # Modal — barcode
  add-food.tsx          # Modal — log food
src/
  components/           # Presentational UI (CalorieRing, MealSection, …)
  context/              # AppContext — boot, settings, auth, yazioAvailable
  db/                   # SQLite schema, queries (diary, food_cache, settings)
  hooks/                # Shared hooks (e.g. useDebounce)
  services/
    diary.ts            # Diary business logic (orchestrates db)
    yazio/              # API client, auth-storage, foods, sync
  types/                # Shared TS types
  utils/                # date, nutrients, barcode, retry, secure-storage
  theme.ts              # colors, spacing — single source for design tokens
scripts/                # expo-cli wrapper, polyfills
```

**Layering rule:** `app/*` screens compose UI and call `src/services/*` or `src/db/*`. Avoid putting SQL or YAZIO calls directly in route files when a service already exists.

## Architecture patterns

### Local-first diary

1. User logs food → write **`diary_entries`** immediately (fast UX).
2. Optional **`yazio_sync_enabled`** → best-effort `syncEntryToYazio` / `syncPendingEntries` (`src/services/yazio/sync.ts`).
3. Food metadata cached in **`food_cache`** (search/barcode); JSON columns `nutrients_json`, `serving_json`.

### YAZIO client lifecycle

- Singleton in `src/services/yazio/client.ts`: `initYazioClient()`, `getYazioClient()`, `loginWithCredentials()`, `logoutYazio()`.
- Tokens/credentials in `auth-storage.ts` (secure store).
- On API failure, UI can set `yazioAvailable` false (`OfflineBanner`) — diary still works.

### App bootstrap

`AppProvider` (`src/context/AppContext.tsx`):

1. `getDatabase()` + migrate
2. `refreshSettings()` / `refreshAuth()`
3. `ready === true` → `app/_layout.tsx` routes to `/login` or `/(tabs)`

### Auth routing

`RootNavigator` uses `useSegments()` + `router.replace` — do not duplicate auth checks in every screen unless needed for modals.

## Coding conventions (match existing code)

- **TypeScript:** explicit types for public APIs; shared domain types in `src/types/index.ts`.
- **SQLite booleans:** `INTEGER` 0/1 (`yazio_synced`, `is_favorite`) — not JS `boolean` in DB rows.
- **IDs:** diary entry IDs generated in sync layer (`Date.now()` + random); DB uses `TEXT PRIMARY KEY`.
- **Dates:** store as `YYYY-MM-DD` strings (`toDateKey` in `src/utils/date.ts`).
- **Styling:** Prefer **gluestack-ui** components (`components/ui/*`) with NativeWind `className`; keep `src/theme.ts` for domain tokens (meal colors, layout). Use `StyleSheet` only for unmigrated screens or SVG-heavy widgets. Import gluestack via `@ui/…` (e.g. `@ui/button`); app code stays on `@/…` → `src/`.
- **Icons:** `@expo/vector-icons` (Ionicons).
- **Lists:** prefer stable keys; memoize heavy child components when profiling shows need.
- **Network:** wrap flaky YAZIO calls with `withRetry` (`src/utils/retry.ts`) — retries 5xx/429, not most 4xx.
- **Search:** debounce user input with `useDebounce` (~200ms) before hitting API/cache.

## React / React Native best practices

### Components

- Prefer **function components** + hooks.
- Keep screens thin; extract reusable UI to `src/components/`.
- Use **`Pressable`** over legacy `TouchableOpacity` for new code (existing code may mix — follow nearby file).
- **`useCallback` / `useMemo`** for context values and handlers passed to memoized children (see `AppContext`).
- Reload screen data on focus with **`useFocusEffect`** when returning from modals (see `app/(tabs)/index.tsx`).

### State

- **Global:** `AppContext` for auth, settings, `yazioAvailable`, `ready`.
- **Local:** `useState` for screen-specific UI (selected date, refresh, form fields).
- Avoid new global state libraries unless the app grows substantially.

### Expo Router

- File names define routes; group folders `(tabs)` don't affect URL.
- Modals: `presentation: 'modal'` in `_layout.tsx` for `scan`, `add-food`.
- Use `useRouter()` for navigation; `router.push` / `replace` / `back` as appropriate.
- Deep links: scheme `dietinator` in `app.json`.

### Performance

- Batch DB reads with `Promise.all` where independent (diary list + totals).
- Cache food search results in SQLite before refetching.
- Don't block UI on sync — fire-and-forget or background sync with clear UI state.
- Images/assets: keep in `assets/`; reference via Expo static requires.

### Platform differences

| Feature            | Native            | Web                                    |
| ------------------ | ----------------- | -------------------------------------- |
| Secure credentials | expo-secure-store | localStorage prefix `calorie_tracker_` |
| Barcode scan       | expo-camera       | limited — test before assuming         |
| SQLite             | expo-sqlite       | supported in Expo 56 web with plugin   |

Test both targets when touching storage, camera, or native modules.

## TypeScript

- `strict` is on — no `any` without justification; prefer `unknown` + narrowing for errors.
- Use **`import type`** for type-only imports.
- Align DB row shapes with interfaces in `src/types/index.ts`; map JSON strings at service boundary.

## Security & privacy

- Credentials/tokens only via `secure-storage` / `auth-storage` — never log them.
- No PII in analytics (there are none).
- Export features (JSON/CSV) are user-initiated — don't auto-upload diary data.
- Web `localStorage` for secrets is weaker than native keystore — document if changing auth flow.

## What to avoid

- Adding Redux, ORMs, or extra UI libraries beyond gluestack-ui for this small codebase.
- Installing npm package **`node`** (fake runtime) — breaks Expo; README documents this.
- Breaking offline diary when YAZIO is down.
- Committing API keys (none required today — user YAZIO login only).
- Force-pushing or changing git config unless the user explicitly asks.

## Commands

```bash
nvm use              # Node 22 from .nvmrc
npm install          # or npm ci in CI/container
npm start            # Metro + Expo
npm run android
npm run ios
npm run web
npm run typecheck    # tsc --noEmit after substantive TS changes
npm run lint         # ESLint (eslint-config-expo flat config)
npm run format       # Prettier — write across the repo
npm run format:check # Prettier — verify (runs in CI)
npm test             # Jest unit tests (utils, services, migrations)
npm run build:web    # production web export → dist/
npm run serve:web    # serve dist/ with COEP/COOP + YAZIO proxy (needs build first)
npm run test:e2e     # build + Playwright (phone viewport, offline/local-first flows)
npm run test:e2e:dev # Playwright against a running `npm run dev:web` (fast loop)
```

**Quality gates:** husky pre-commit runs `lint-staged` (eslint --fix + prettier on staged files). CI (`.github/workflows/ci.yml`) runs typecheck, lint, `format:check`, e2e, and a gitleaks secret scan on every push/PR. Dependabot updates npm + GitHub Actions weekly (`yazio` is ignored — unofficial API, pin manually).

**Iteration notes:** Expo SDK 56 is Metro-only (no Vite). For web UI iteration use `npm run dev:web` + `npm run test:e2e:dev`. E2E tests seed a fake local session in localStorage and never need YAZIO credentials; run the local-first path only. Playwright MCP is configured in `.opencode/opencode.json` — prefer it over hand-written selectors when driving the browser.

**Dev Container:** `.devcontainer/devcontainer.json` — Node 22, `npm ci` on create, ports 8081/8082/19000+.

**Docker Compose:** web-oriented reproducible build (`docker compose up --build`). Physical device Expo Go usually needs Metro on the **host** or tunnel.

## Database (quick reference)

- **`diary_entries`** — logged meals; `yazio_synced`, `yazio_item_id` for sync state.
- **`food_cache`** — YAZIO products + favorites + `last_used_at`.
- **`settings`** — single row `id = 1` goals and `yazio_sync_enabled`.

Schema changes: update `migrate()` in `src/db/database.ts` only (no separate migration runner yet). Use `IF NOT EXISTS` / additive columns for compatibility.

## Testing & quality

- **Unit tests:** Jest + jest-expo in `src/**/__tests__/` (`npm test`) — utils, diary/backup services (mocked DB), and the migration contract. Add tests for new pure logic.
- Manual smoke: login → search food → add entry → see dashboard → optional sync → offline add with cached food → barcode scan on device.

## Useful files for common tasks

| Task              | Start here                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| New screen        | `app/` + register in `app/_layout.tsx` if outside tabs                                                                    |
| Diary CRUD        | `src/db/diary.ts`, `src/services/diary.ts`                                                                                |
| Food search/cache | `src/services/yazio/foods.ts`, `src/db/food-cache.ts`                                                                     |
| Goals/settings    | `src/db/settings.ts`, Settings tab                                                                                        |
| In-app updates    | `src/services/updates.ts`, `src/context/UpdateContext.tsx`, `public/` release pipeline in `.github/workflows/release.yml` |
| Theme/colors      | `src/theme.ts`                                                                                                            |
| Auth flow         | `app/login.tsx`, `src/services/yazio/client.ts`                                                                           |

## Agent workflow checklist

1. Read relevant `src/services` and `src/db` modules before editing screens.
2. Preserve local-first behavior and offline paths.
3. Match import style: `@/…` for `src`, relative only within same feature if already done.
4. Run `npm start` or typecheck via `npx tsc --noEmit` after substantive TS changes.
5. Do not commit unless the user asks.
6. Keep diffs minimal — no drive-by refactors.

## References

- [Expo SDK 56 docs](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- Project `README.md` for setup pitfalls (Node version, fake `node` package, Docker vs mobile).
