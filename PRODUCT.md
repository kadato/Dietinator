# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

**Primary. Solo health tracker.** One person managing their own nutrition day to day. Opens Dietinator in the kitchen, at the desk, on the walk home, or right after a weigh-in. Jobs: log what was just eaten with minimal taps, see remaining calorie and macro budget instantly before committing, keep streaks and hydration moving, review the day without second-guessing. Values privacy, speed, and continuity over social features. Low tolerance for login friction, paywalls, or waiting on network.

**Secondary. AI-assisted self-coach.** Same person when they want a second pair of eyes. Asks for a daily review, protein check, snack ideas, or a reset without leaving the diary. Uses the in-app assistant or an external MCP agent as a tool, not a destination. Wants streaming answers grounded in their own last 14 days, with confirmations before destructive actions.

**Excluded by design.** Teams, coaches managing clients, meal-plan commerce, and social feeds are out of scope. Personal use only.

## Product purpose

Dietinator is a local-first calorie and macro tracker that makes logging feel instant and staying in budget feel obvious. Diary entries live in on-device SQLite, food metadata is cached, and everything works offline. Search and best-effort sync use the unofficial YAZIO food database when available, never as a gate. Success is a solo user who logs most days without thinking about it, stays inside their goals, and trusts the numbers even when YAZIO is down. Demo mode at `/?demo=1` lets anyone try a full session with no account.

## Positioning

The diary never waits for the network. Every log writes locally first, sync queues as `yazio_synced = 0` and retries later with `withRetry` on 5xx and 429 only, and cold starts render from SQLite before any import touches the UI. Food search is debounced, cached in `food_cache`, and served cache-first on repeats and barcodes. The same diary powers an on-device AI tool layer and a stateless MCP endpoint at `/mcp` plus `/api/agent/*` snapshot bridge for external agents. No analytics SDKs, no required account, no blocking dependency on an unofficial API.

## Operating context

**Where it is used.** Phones one-handed between bites, tablets on a kitchen counter, desktop browser at work. Light and dark themes follow system preference or explicit `theme_preference` in settings. Offline banner appears when `yazioAvailable` flips false.

**Core workflows.** Boot via `AppProvider`: migrate SQLite, refresh settings and auth, route to `/login` or `/(tabs)`. Dashboard: date navigation, calorie ring, macro bars, meal sections by type, water and weight quick-adds, streak flame, copy previous day, pull to refresh from YAZIO, nutrition breakdown modals. Search: debounced YAZIO query, favorites and recents pinned, serving sizes with remembered `last_amount`, amount steppers with hold-repeat, live daily budget impact, barcode scan on device via expo-camera. Meals: builder for reusable combinations, quick-add for direct kcal and macros. Settings: goals for calories, protein, carbs, fat, water, height, target weight, YAZIO sync toggle, AI provider config, theme choice, export and restore, GitHub release check.

**Data shape.** `diary_entries` keyed by text id, `food_cache` with `nutrients_json` and `serving_json`, `meals` and `meals_items`, single-row `settings id = 1`, `weight_entries`, `water_entries`, `ai_chat_messages`. Dates are `YYYY-MM-DD` via `toDateKey`. Booleans are integer 0 and 1 in SQLite.

**Rhythms.** Daily logging streaks, 14-day diary snapshots pushed to the MCP bridge on boot and after every change, 365-day calorie history for adherence, weekly weight and water trends.

## Capabilities and constraints

**Capabilities.** Instant offline logging and editing with undo, meal grouping with per-slot budgets, multilingual dynamic food icons, favorites ordering, recent foods by exact amount, named servings and gram amounts, barcode EAN and UPC lookup, water logging with +250ml preset and intake versus goal, weight check-ins with BMI and goal progress, calorie ring and macro bars, micronutrient breakdown for single entries and full days, CSV and JSON export, full DB backup and restore, AI chat with OpenAI, OpenRouter, OpenCode, Ollama or any OpenAI-compatible endpoint, streaming history persisted in SQLite, tool approvals for destructive writes, MCP write tools mirrored into the snapshot and applied on next focus as a revisioned change log.

**Constraints.** Expo SDK 56, React 19.2, RN 0.85, expo-router file-based routes in `app/`, expo-sqlite WAL with migrations only in `src/db/database.ts` additive `IF NOT EXISTS`, expo-secure-store with `calorie_tracker_` localStorage fallback on web, Node at least 20.19.4 and 22 LTS recommended, scripts through `scripts/expo-cli.cjs`, path aliases `@/*` to `src/*` and `@ui/*` to `components/ui/*`, gluestack-ui v3 plus NativeWind v4, icons from Ionicons, Metro-only web bundling on port 9082, no Vite, no analytics, personal YAZIO use only with no committed uptime, never commit credentials or `.env` secrets, keep `@yazio` dependency pinned manually and ignored by Dependabot.

**Undecided.** Whether to add collaborative or social features later, confirmed earlier as not in scope for this pass.

## Brand commitments

Name Dietinator. Current identity is Teal Precision: primary ` #115e59` light and `#2dd4bf` dark, surfaces `#ffffff` and `#e8eaee` light and `#1a1a1e` and `#26262c` dark, backgrounds `#f4f5f7` and `#121215`, danger and warning tokens, meal accents breakfast teal, lunch orange, dinner pink, snack yellow with tints cleared to 4.5:1 for labels on chips. Type is Plus Jakarta Sans for UI and JetBrains Mono tabular for numbers, with Geist as secondary fallback. Tone today is quiet, precise, system-like. User confirmed the system may evolve warmer and bolder when it strengthens the product story, while keeping contrast and legibility invariants.

Evidence paths: `src/theme.ts`, `global.css`, `tailwind.config.js`, `app.json` adaptive icon `#0d9488`, `assets/icon.png`, screenshots in `docs/screenshots/`.

## Evidence on hand

Real product with runnable web and Android builds. Routes in `app/(tabs)/` and modals `scan`, `add-food`, `log-meal`, `meal-builder`, `manual-entry`, `create-options`. Services in `src/services/diary.ts`, `src/services/yazio/`, `src/db/` with WAL migrations, `src/utils/` pure helpers covered by Jest plus Playwright e2e at phone viewport for offline and local-first flows. CI runs typecheck, lint, format, coverage, e2e and gitleaks. Screenshots for dashboard, stats, AI chat, search, add-food, meal builder, log-meal and settings in `docs/screenshots/`. No fabricated testimonials. AI provider choice requires user-owned API key stored only in device keystore.

## Product principles

1. **Local truth first.** The diary renders from SQLite before any network. Sync is optional and never blocks logging, editing, or reading.
2. **Zero-friction logging.** Every numeric field has minus and plus steppers with hold-repeat, remembers the last amount, and shows live budget impact before save. One tap beats typing.
3. **Clarity over cleverness.** Remaining budget, macro bars, calorie ring and meal slots tell the truth at a glance. Exact numbers in tabular mono, never ambiguous color alone.
4. **Privacy is a feature.** No analytics, no required account, on-device storage and AI tool grounding. Demo seeds itself without touching disk beyond the local DB.
5. **Stay usable when YAZIO breaks.** Cache-first search and recents, offline banner, background refinement of stale nutrients. The unofficial API may change without notice and the app must not.

## Accessibility and inclusion

Full light and dark themes with system detection and explicit override. Contrast cleared to 4.5:1 for text on tinted chips and badges per `src/theme.ts` comments. Touch targets and tab bar at `64px` plus safe-area insets, keyboard-dismiss on modals, accessible labels on interactive controls. Web fallback for secure storage is weaker than native keystore, surfaced when auth flow changes. No additional product-specific accessibility mandate was established.
