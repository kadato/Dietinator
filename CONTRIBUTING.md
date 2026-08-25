# Contributing

Dietinator is a personal, local-first calorie tracker. Pull requests and issues
are welcome. A few ground rules keep the project healthy:

## Ground rules

- **Local-first always.** The diary must keep working with no network. Never
  let a YAZIO failure block a local write, and keep the offline e2e suite green
  via `pnpm run test:e2e`.
- **No ads, no tracking, no analytics SDKs.** Error monitoring and metrics
  must be opt-in and privacy-preserving.
- **Respect the unofficial API.** The `yazio` npm package is a reverse-engineered
  client of an API we do not own. Do not productize, redistribute, or abuse it.
  Changes to the integration must keep the local paths intact, because the API can
  break without notice.
- **No secrets in the repo.** Credentials, tokens and `.env` files never get
  committed. CI runs a gitleaks secret scan on every push.

## Development setup

```bash
nvm use            # 22, see .nvmrc
pnpm install
pnpm start         # Metro + Expo (use the wrapper script, never raw npx expo)
```

Web iteration loop: `pnpm run dev:web` + `pnpm run test:e2e:dev`.

## Quality gates

All gates must pass before merging.

```bash
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm test
pnpm run test:e2e  # builds the web export. YAZIO specs skip without credentials
```

Pre-commit, `husky` runs `lint-staged` (eslint --fix + prettier) on staged files.

## Code conventions

- TypeScript `strict`. Use `import type` for type-only imports.
- SQLite booleans are `INTEGER` 0/1. Dates are `YYYY-MM-DD` keys via `toDateKey`.
- Screens live in `app/`, UI in `src/components/`, logic in `src/services/`
  and `src/db/`. No SQL or YAZIO calls in route files.
- Styling via gluestack-ui components plus NativeWind classes. Design tokens live in
  `src/theme.ts`.
- Prettier plus ESLint enforce the style. No semicolons, double quotes.

## Commits

Conventional Commits with a scope, for example `feat(diary): ...`, `fix(sync): ...`,
`ci(workflows): ...`. Keep changes focused and reviewable.

## Tests

- Unit tests. Jest plus jest-expo in `src/**/__tests__/` via `pnpm test`.
  Pure `utils/` functions and service logic with mocked DB modules are covered.
  Add tests for new pure logic.
- E2E. Playwright against the web export in `e2e/` at phone viewport for
  local-first flows. YAZIO specs run only with credentials in `.env.local`.
- Schema changes. Add a case to `src/db/__tests__/database.test.ts` pinning the
  new migration SQL.
