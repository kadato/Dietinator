# Changelog

All notable changes to Dietinator. Format follows
[Keep a Changelog](https://keepachangelog.com/) and versioning follows
[semver](https://semver.org/). Releases are cut with `npm run release`
(see `scripts/release.cjs`), which tags `vX.Y.Z`; the release pipeline then
builds the signed APK and posts the changelog to the GitHub release.

## [1.1.0] - 2026-08-11

### Added

- Weight logging directly from the dashboard weight row, prioritizing locally logged
  weigh-ins over the remote YAZIO profile value
- Named serving sizes (cup, whole, piece) with proportional calorie scaling
  for countable units
- Remembered amounts: prefill previously logged portion sizes when reopening food details
- Numeric steppers: increment and decrement buttons with press-and-hold repeat on numeric fields
- Food search: clear button, with persistent recent and favorite items during search queries
- Meal logging screen: list existing daily entries with inline edit and delete actions

### Performance

- Redundant database indexes dropped
- Weight history reads use indexed queries instead of full scans

### Fixed

- The diary stats tool test no longer depends on the wall clock date

## [1.0.0] - 2026-08-08

First public release.

### Features

- Local-first diary: SQLite with WAL, instant logging, daily calorie/macro
  dashboard, meals (reusable food combos), manual entries, Quick Add
- YAZIO food search: debounced, SQLite-cached, favorites + recents
- Barcode scanning (EAN/UPC) with cache-first lookup
- Optional best-effort sync to a YAZIO account; offline-friendly
- Backup/restore of all local data as a single JSON file
- Export diary as JSON or CSV (formula-safe cells)
- Demo mode: explore the full UI without an account
- In-app update dialog with changelog (Android, via GitHub releases)
- Web build with service worker, app shell, and long-lived cache headers
- Responsive UI: phone modals, desktop dialog layout, wide-screen tabs
- Error boundary and network-aware offline banner

### Fixed

- Retry policy now recovers YAZIO status codes from error messages
- Nested buttons in food list rows (accessibility/correctness)
- Web toasts anchored to the viewport bottom
- Food search placeholder mismatch in tests

### Performance

- Boot settings and auth reads run in parallel
- Memoized dashboard and food list rows
- Cached meal ingredients and wider offline food search

### Quality

- TypeScript strict, ESLint (eslint-config-expo), Prettier, husky +
  lint-staged, gitleaks secret scan in CI
- Jest unit tests for utils, diary service, backup, and DB migrations
- Playwright e2e suite (phone viewport, offline/local-first flows)
- CI runs typecheck, lint, format check, unit tests, e2e, and secret scan

[1.1.0]: https://github.com/kadato/Dietinator/releases/tag/v1.1.0
[1.0.0]: https://github.com/kadato/Dietinator/releases/tag/v1.0.0
