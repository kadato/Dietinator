# Changelog

All notable changes to Dietinator. Format follows
[Keep a Changelog](https://keepachangelog.com/) and versioning follows
[semver](https://semver.org/). Cut releases with `pnpm run release`
in `scripts/release.cjs`, which tags `vX.Y.Z`. The release pipeline then
builds the signed APK and posts the changelog to the GitHub release.

## [1.1.0] - 2026-08-11

### Added

- Weight logging directly from the dashboard weight row. Local weigh-ins take priority over the remote YAZIO profile value.
- Named serving sizes like cup, whole, and piece with proportional calorie scaling for countable units.
- Remembered amounts. The app prefills previously logged portion sizes when you reopen food details.
- Numeric steppers. Increment and decrement buttons support press-and-hold repeat on numeric fields.
- Food search with clear button, persistent recent items, and favorite items during search queries.
- Meal logging screen. The screen lists existing daily entries with inline edit and delete actions.

### Performance

- Dropped redundant database indexes.
- Weight history reads use indexed queries instead of full scans.

### Fixed

- The diary stats tool test no longer depends on the wall clock date.

## [1.0.0] - 2026-08-08

First public release.

### Features

- Local-first diary with SQLite and WAL, instant logging, daily calorie and macro
  dashboard, meals for reusable food combos, manual entries, and Quick Add.
- YAZIO food search with debounce, SQLite cache, favorites and recents.
- Barcode scanning for EAN and UPC with cache-first lookup.
- Optional best-effort sync to a YAZIO account. The sync is offline-friendly.
- Backup and restore of all local data as a single JSON file.
- Export diary as JSON or CSV with formula-safe cells.
- Demo mode. Explore the full UI without an account.
- In-app update dialog with changelog on Android with GitHub releases.
- Web build with service worker, app shell, and long-lived cache headers.
- Responsive UI with phone modals, desktop dialog layout, and wide-screen tabs.
- Error boundary and network-aware offline banner.

### Fixed

- Retry policy now recovers YAZIO status codes from error messages.
- Nested buttons in food list rows for accessibility and correctness.
- Web toasts anchored to the viewport bottom.
- Food search placeholder mismatch in tests.

### Performance

- Boot settings and auth reads run in parallel.
- Memoized dashboard and food list rows.
- Cached meal ingredients and wider offline food search.

### Quality

- TypeScript strict, ESLint with eslint-config-expo, Prettier, Husky with
  lint-staged, and gitleaks secret scan in CI.
- Jest unit tests for utils, diary service, backup, and DB migrations.
- Playwright e2e suite at phone viewport for offline and local-first flows.
- CI runs typecheck, lint, format check, unit tests, e2e, and secret scan.

[1.1.0]: https://github.com/kadato/Dietinator/releases/tag/v1.1.0
[1.0.0]: https://github.com/kadato/Dietinator/releases/tag/v1.0.0
