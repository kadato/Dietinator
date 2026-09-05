# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

**Primary. Solo health tracker.** One person manages nutrition day to day. The person opens Dietinator in the kitchen, at the desk, on the walk home, or right after a weigh-in. Jobs: log what was just eaten with minimal taps. See remaining calorie and macro budget instantly before you save. Keep streaks and hydration moving. Review the day without second-guessing. The person values privacy, speed, and continuity over social features. The person has low tolerance for login friction, paywalls, and waiting on network.

**Secondary. AI-assisted self-coach.** The same person wants a second pair of eyes at times. The person asks for a daily review, protein check, snack ideas, or a reset without leaving the diary. The person uses the in-app assistant or an external MCP agent as a tool, not a destination. The person wants streaming answers grounded in the last 14 days, with confirmations before destructive actions.

**Excluded by design.** Teams, coaches managing clients, meal-plan commerce, and social feeds are out of scope. Personal use only.

## Product purpose

Dietinator is a local-first calorie and macro tracker. Logging feels instant. Remaining budget stays obvious. Diary entries live in on-device SQLite. The app caches food metadata. Everything works offline. Search and best-effort sync use the unofficial YAZIO food database when available, never as a gate. Success is a solo user who logs most days without thinking about the tool, stays inside goals, and trusts the numbers even when YAZIO is down. Demo mode at `/?demo=1` lets anyone try a full session with no account.

## Positioning

The diary never waits for the network. Every log writes locally first. Sync queues with `yazio_synced = 0` and retries later with `withRetry` on 5xx and 429 only. Cold starts render from SQLite before any import touches the UI. Food search is debounced, cached in `food_cache`, and served cache-first on repeats and barcodes. The same diary powers an on-device AI tool layer and a stateless MCP endpoint at `/mcp` with an `/api/agent` snapshot bridge for external agents. The app includes no analytics SDKs, needs no account, and has no blocking dependency on an unofficial API.

## Operating context

**Where it is used.** People use phones one-handed between bites, tablets on a kitchen counter, and desktop browsers at work. Light and dark themes follow system preference or explicit `theme_preference` in settings. The offline banner appears when `yazioAvailable` turns false.

**Core workflows.** `AppProvider` boots the app. It migrates SQLite, refreshes settings and auth, then routes to `/login` or `/(tabs)`. Dashboard supports date navigation, calorie ring, macro bars, meal sections by type, water and weight quick-adds, streak flame, copy of the previous day, pull to refresh from YAZIO, and nutrition breakdown modals. Search sends a debounced YAZIO query. It pins favorites and recents. It shows serving sizes with remembered `last_amount`, amount steppers with hold-repeat, live daily budget impact, and barcode scan on device with expo-camera. Meals include a builder for reusable combinations and quick-add for direct kcal and macros. Settings hold goals for calories, protein, carbs, fat, water, height, and target weight, with YAZIO sync toggle, AI provider config, theme choice, export and restore, and GitHub release check.

**Data shape.** `diary_entries` use text id. `food_cache` holds `nutrients_json` and `serving_json`. The DB also holds `meals` and `meals_items`, single-row `settings` with `id = 1`, `weight_entries`, `water_entries`, and `ai_chat_messages`. Dates use `YYYY-MM-DD` with `toDateKey`. Booleans use integer 0 and 1 in SQLite.

**Rhythms.** Daily logging streaks. Diary snapshots for 14 days go to the MCP bridge on boot and after every change. Calorie history covers 365 days for adherence. Weight and water trends aggregate weekly.

## Capabilities and constraints

**Capabilities.** Instant offline logging and editing with undo. Meal grouping with per-slot budgets. Category food icons. Favorites ordering. Recent foods by exact amount. Named servings and gram amounts. Barcode EAN and UPC lookup. Water logging with 250ml preset and intake versus goal. Weight check-ins with BMI and goal progress. Calorie ring and macro bars. Micronutrient breakdown for single entries and full days. CSV and JSON export. Full DB backup and restore. AI chat with OpenAI, OpenRouter, OpenCode, Ollama, or any OpenAI-compatible endpoint. Streaming history persisted in SQLite. Tool approvals for destructive writes. MCP write tools mirrored into the snapshot and applied on next focus as a revisioned change log.

**Constraints.** Expo SDK 57, React 19.2, RN 0.86, expo-router file-based routes in `app`, expo-sqlite WAL with migrations only in `src/db/database.ts` with additive `IF NOT EXISTS`, expo-secure-store with `calorie_tracker_` localStorage fallback on web, Node at least 20.19.4 with 22 LTS recommended, scripts through `scripts/expo-cli.cjs`, path aliases `@` to `src` and `@ui` to `components/ui`, gluestack-ui v3 with NativeWind v4, icons from Ionicons, Metro-only web bundling on port 9082 with no Vite, no analytics, personal YAZIO use only with no committed uptime, never commit credentials or `.env` secrets, keep `yazio` dependency pinned manually and ignored by Dependabot.

**Undecided.** Collaborative or social features stay out of scope for this pass.

## Brand commitments

Name Dietinator. Current identity is Teal Precision with primary `#115e59` light and `#2dd4bf` dark, surfaces `#ffffff` and `#e8eaee` light and `#1a1a1e` and `#26262c` dark, backgrounds `#f4f5f7` and `#121215`, danger and warning tokens, and meal accents with breakfast teal, lunch orange, dinner pink, and snack yellow with tints cleared to 4.5 to 1 for labels on chips. Type is Plus Jakarta Sans for UI and JetBrains Mono tabular for numbers, with Geist as secondary fallback. Tone today is quiet, precise, and system-like. The system may evolve warmer and bolder when a warmer story strengthens the product, while contrast and legibility invariants stay.

Evidence paths: `src/theme.ts`, `global.css`, `tailwind.config.js`, `app.json` adaptive icon `#0d9488`, `assets/icon.png`, screenshots in `docs/screenshots`.

## Evidence on hand

Real product with runnable web and Android builds. Routes live in `app/(tabs)` with modals `scan`, `add-food`, `log-meal`, `meal-builder`, `manual-entry`, and `create-options`. Services live in `src/services/diary.ts` and `src/services/yazio`. The DB lives in `src/db` with WAL migrations. Pure helpers live in `src/utils` and Jest covers them with Playwright e2e at phone viewport for offline and local-first flows. CI runs typecheck, lint, format, coverage, e2e and gitleaks. Screenshots for dashboard, stats, AI chat, search, add-food, meal builder, log-meal and settings live in `docs/screenshots`. The product includes no fabricated testimonials. AI provider choice requires user-owned API key stored only in device keystore.

## Product principles

1. **Local truth first.** The diary renders from SQLite before any network. Sync is optional and never blocks logging, editing, or reading.
2. **Zero-friction logging.** Every numeric field has minus and plus steppers with hold-repeat. Each field remembers the last amount. Each field shows live budget impact before save. One tap beats typing.
3. **Clarity over cleverness.** Remaining budget, macro bars, calorie ring and meal slots tell the truth at a glance. Exact numbers use tabular mono, never ambiguous color alone.
4. **Privacy is a feature.** The app includes no analytics and needs no account. Storage stays on-device with AI tool grounding. Demo seeds itself without touching disk beyond the local DB.
5. **Stay usable when YAZIO breaks.** Search is cache-first with recents, offline banner, and background refinement of stale nutrients. The unofficial API may change without notice and the app must keep working.

## Accessibility and inclusion

Full light and dark themes with system detection and explicit override. Contrast clears 4.5 to 1 for text on tinted chips and badges per `src/theme.ts` comments. Touch targets and tab bar use `64px` plus safe-area insets, with keyboard-dismiss on modals and accessible labels on interactive controls. Web fallback for secure storage is weaker than native keystore. The app surfaces the difference when the auth flow changes. The product defines no additional accessibility mandate.
