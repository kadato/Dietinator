# AGENTS.md for Dietinator

Guidance for AI agents and contributors working on this codebase.

## Project summary

Dietinator is a personal calorie tracker built with Expo SDK 57 and React Native. The app is local-first. Diary entries live in SQLite on device. Food search and optional sync use the unofficial `yazio` npm client, a reverse-engineered API. The app includes no analytics SDKs.

**Constraints agents must respect.**

- Personal use only. Do not productize or redistribute YAZIO API access.
- Never commit credentials, tokens, or `.env` secrets.
- YAZIO integration may break without notice. Keep offline and local paths working.

## Tech stack

| Area         | Choice                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Runtime      | Node **≥ 20.19.4** with `.nvmrc` pins 22 LTS                                                        |
| Framework    | Expo **~57**, React **19.2**, RN **0.86**                                                           |
| Navigation   | **expo-router** with file-based routes in `app`                                                     |
| DB           | **expo-sqlite** with WAL and migrations in `src/db/database.ts`                                     |
| Auth secrets | **expo-secure-store** with prefixed `localStorage` fallback on web in `src/utils/secure-storage.ts` |
| Camera       | **expo-camera** for barcode scan on device or dev build, not all web browsers                       |
| Path alias   | `@` maps to `src`, `@ui` to `components/ui` in `tsconfig.json`                                      |
| UI           | **gluestack-ui v3** and **NativeWind** v4 in `components/ui` and `global.css`                       |
| TypeScript   | `strict: true`                                                                                      |

Start scripts go through `scripts/expo-cli.cjs` for the Node version gate and `polyfill-os.cjs`. Unless you debug the wrapper, use `pnpm start`, not raw `npx expo`.

## Repository layout

```
app/                    # Expo Router screens (UI routes only)
  _layout.tsx           # Auth gate, Stack, AppProvider
  login.tsx
  (tabs)/               # Main tab navigator
  scan.tsx              # Barcode modal
  add-food.tsx          # Log-food modal
src/
  components/           # Presentational UI (CalorieRing, MealSection, …)
  context/              # AppContext boot, settings, auth, yazioAvailable
  db/                   # SQLite schema, queries (diary, food_cache, settings)
  hooks/                # Shared hooks (for example useDebounce)
  services/
    diary.ts            # Diary business logic (orchestrates db)
    yazio/              # API client, auth-storage, foods, sync
  types/                # Shared TS types
  utils/                # date, nutrients, barcode, retry, secure-storage
  theme.ts              # colors, spacing, single source for design tokens
scripts/                # expo-cli wrapper, polyfills
```

**Layering rule.** `app/*` screens compose UI and call `src/services/*` or `src/db/*`. When a service already exists, avoid putting SQL or YAZIO calls directly in route files.

## Architecture patterns

### Local-first diary

1. The user logs food. The app writes the `diary_entries` row immediately for fast UX.
2. When `yazio_sync_enabled` is on, `syncEntryToYazio` and `syncPendingEntries` in `src/services/yazio/sync.ts` push the row best-effort.
3. The app caches food metadata in `food_cache` for search and barcode. The service boundary parses JSON columns `nutrients_json` and `serving_json`.

### YAZIO client lifecycle

- Singleton in `src/services/yazio/client.ts` with `initYazioClient`, `getYazioClient`, `loginWithCredentials`, and `logoutYazio`.
- Tokens and credentials live in `auth-storage.ts` in secure store.
- On API failure, the UI can set `yazioAvailable` false with `OfflineBanner`. The diary still works.

### App bootstrap

`AppProvider` in `src/context/AppContext.tsx`:

1. `getDatabase` plus migrate
2. `refreshSettings` plus `refreshAuth`
3. When `ready` is true, `app/_layout.tsx` routes to `/login` or `/(tabs)`

### Auth routing

`RootNavigator` uses `useSegments` and `router.replace`. Unless a modal needs it, do not duplicate auth checks in every screen.

## Coding conventions

- **TypeScript.** Use explicit types for public APIs. Shared domain types live in `src/types/index.ts`.
- **SQLite booleans.** Use `INTEGER` 0 or 1 for `yazio_synced` and `is_favorite`. Do not store JS `boolean` in DB rows.
- **IDs.** The sync layer generates diary entry IDs with `Date.now` plus random. The DB uses `TEXT PRIMARY KEY`.
- **Dates.** Store dates as `YYYY-MM-DD` strings with `toDateKey` in `src/utils/date.ts`.
- **Styling.** Prefer gluestack-ui components in `components/ui` with NativeWind `className`. Keep domain tokens for meal colors and layout in `src/theme.ts`. Use `StyleSheet` only for unmigrated screens or SVG-heavy widgets. Import gluestack with `@ui` prefix, for example `@ui/button`. Keep app code on `@` prefix, which maps to `src`.
- **Icons.** Use `@expo/vector-icons` with Ionicons.
- **Lists.** Prefer stable keys. Memoize heavy child components when profiling shows need.
- **Network.** Wrap flaky YAZIO calls with `withRetry` in `src/utils/retry.ts`. `withRetry` retries 5xx and 429 responses. It skips most other 4xx responses.
- **Search.** Debounce user input with `useDebounce` for about 200ms before you hit the API or the cache.

## React and React Native best practices

### Components

- Prefer function components and hooks.
- Keep screens thin. Extract reusable UI to `src/components`.
- For new code, use `Pressable` over legacy `TouchableOpacity`. Existing code may mix, so follow the nearby file.
- Use `useCallback` and `useMemo` for context values and handlers passed to memoized children. See `AppContext`.
- When you return from modals, reload screen data on focus with `useFocusEffect`. See `app/(tabs)/index.tsx`.

### State

- **Global.** Use `AppContext` for auth, settings, `yazioAvailable`, and `ready`.
- **Local.** Use `useState` for screen-specific UI like selected date, refresh, and form fields.
- Avoid new global state libraries unless the app grows substantially.

### Expo router

- File names define routes. Group folder `app/(tabs)` does not affect the URL.
- Modals use `presentation: 'modal'` in `_layout.tsx` for `scan` and `add-food`.
- Use `useRouter` for navigation. Use `router.push`, `replace`, or `back` as appropriate.
- Deep links use scheme `dietinator` in `app.json`.

### Performance

- Batch independent DB reads with `Promise.all`, for example diary list plus totals.
- Cache food search results in SQLite before you refetch.
- Do not block UI on sync. Use fire-and-forget or background sync with clear UI state.
- Images and assets. Keep files in `assets`. Reference files with Expo static requires.

### Platform differences

| Feature            | Native            | Web                                    |
| ------------------ | ----------------- | -------------------------------------- |
| Secure credentials | expo-secure-store | localStorage prefix `calorie_tracker_` |
| Barcode scan       | expo-camera       | limited on web, test before you assume |
| SQLite             | expo-sqlite       | supported in Expo 57 web with plugin   |

When you change storage, camera, or native modules, test both native and web.

## TypeScript

- `strict` is on. Avoid `any` without justification. Prefer `unknown` and narrowing for errors.
- Use `import type` for type-only imports.
- Align DB row shapes with interfaces in `src/types/index.ts`. Map JSON strings at the service boundary.

## Security and privacy

- Store credentials and tokens only with `secure-storage` or `auth-storage`. Never log credentials or tokens.
- The app includes no analytics, so it stores no PII for analytics.
- Export features for JSON and CSV are user-initiated. Do not auto-upload diary data.
- Web `localStorage` for secrets is weaker than the native keystore. If you change the auth flow, document the change.

## What to avoid

- Do not add Redux, ORMs, or extra UI libraries beyond gluestack-ui for this small codebase.
- Do not install npm package `node`, a fake runtime. The `node` package breaks Expo. `README.md` documents the breakage.
- Do not break offline diary when YAZIO is down.
- Do not commit API keys. The app needs no API keys today, only user YAZIO login.
- Unless the user explicitly asks, do not force-push or change git config.

## Commands

```bash
nvm use              # Node 22 from .nvmrc
pnpm install         # or pnpm install --frozen-lockfile in CI
pnpm start           # Metro + Expo
pnpm run android
pnpm run ios
pnpm run web
pnpm run typecheck   # tsc --noEmit after substantive TS changes
pnpm run lint        # ESLint (eslint-config-expo flat config)
pnpm run format      # Prettier, write across the repo
pnpm run format:check # Prettier, verify (runs in CI)
pnpm test            # Jest unit tests (utils, services, migrations)
pnpm run build:web   # production web export to dist/
pnpm run serve:web   # serve dist/ with COEP/COOP + YAZIO proxy (needs build first)
pnpm run test:e2e    # build + Playwright (phone viewport, offline/local-first flows)
pnpm run test:e2e:dev # Playwright against a running `pnpm run dev:web` (fast loop)
```

**Quality gates.** Husky pre-commit runs `lint-staged` with eslint fix and prettier on staged files. CI in `.github/workflows/ci.yml` runs typecheck, lint, `format:check`, e2e, and a gitleaks secret scan on every push and PR. Dependabot updates pnpm and GitHub Actions weekly. Dependabot ignores `yazio` as an unofficial API, so pin `yazio` manually.

**Iteration notes.** Expo SDK 57 is Metro-only with no Vite. For web UI iteration, use `pnpm run dev:web` and `pnpm run test:e2e:dev`. E2E tests seed a fake local session in localStorage and never need YAZIO credentials. Run only the local-first path. Playwright MCP is configured in `.opencode/opencode.json`. Prefer Playwright MCP over handwritten selectors when you drive the browser.

**Dev Container.** `.devcontainer/devcontainer.json` has Node 22 and runs `pnpm install` on create. It exposes ports 8081, 8082, and 19000 and later.

## Database quick reference

- **`diary_entries`.** Logged meals with `yazio_synced` and `yazio_item_id` for sync state.
- **`food_cache`.** YAZIO products, favorites, and `last_used_at`.
- **`settings`.** Single row `id = 1` with goals and `yazio_sync_enabled`.

To change the schema, update `migrate` in `src/db/database.ts` only. The project has no separate migration runner yet. Use `IF NOT EXISTS` or additive columns for compatibility.

## Testing and quality

- **Unit tests.** Jest and jest-expo run in `src/__tests__` with `pnpm test`. The suite covers utils, diary and backup services with mocked DB, and the migration contract. Add tests for new pure logic.
- Manual smoke. Complete each step in order:
  1. Log in.
  2. Search food.
  3. Add an entry.
  4. Check the dashboard.
  5. Sync if online.
  6. Add an offline entry with a cached food.
  7. Scan a barcode on device.

## Useful files for common tasks

| Task              | Start here                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| New screen        | `app/` and register in `app/_layout.tsx` if outside tabs                                                                  |
| Diary CRUD        | `src/db/diary.ts`, `src/services/diary.ts`                                                                                |
| Food search/cache | `src/services/yazio/foods.ts`, `src/db/food-cache.ts`                                                                     |
| Goals/settings    | `src/db/settings.ts`, Settings tab                                                                                        |
| In-app updates    | `src/services/updates.ts`, `src/context/UpdateContext.tsx`, `public/` release pipeline in `.github/workflows/release.yml` |
| Theme/colors      | `src/theme.ts`                                                                                                            |
| Auth flow         | `app/login.tsx`, `src/services/yazio/client.ts`                                                                           |

## Agent workflow checklist

1. Read relevant `src/services` and `src/db` modules before you edit screens.
2. Preserve local-first behavior and offline paths.
3. Match import style. Use `@` prefix for `src`. Use relative imports only within the same feature if the nearby file already does.
4. After substantive TS changes, run typecheck with `pnpm exec tsc --noEmit`. For UI runs, use `pnpm start`.
5. Do not commit unless the user asks.
6. Keep diffs minimal. Avoid drive-by refactors.

## References

- [Expo SDK 57 docs](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- Project `README.md` for setup pitfalls like Node version, fake `node` package, and Docker versus mobile.
