# Contributing

Dietinator is a personal, local-first calorie tracker. Pull requests and issues
are welcome. A few ground rules keep the project healthy.

## Ground rules

- **Local-first always.** The diary must keep working with no network. Never
  let a YAZIO failure block a local write. Keep the offline e2e suite green
  with `pnpm run test:e2e`.
- **No ads, no tracking, no analytics SDKs.** Error monitoring and metrics
  must be opt-in and privacy-preserving.
- **Respect the unofficial API.** The `yazio` npm package is a reverse-engineered
  client of an API we do not own. Do not productize, redistribute, or abuse the client.
  Keep the local paths intact when you change the integration, because the API can
  break without notice.
- **No secrets in the repo.** Never commit credentials, tokens, or `.env` files. CI runs a gitleaks secret scan on every push.

## Development setup

```bash
nvm use            # 22, see .nvmrc
pnpm install
pnpm start         # Metro and Expo through the wrapper script, never raw npx expo
```

For web UI iteration, use `pnpm run dev:web` and `pnpm run test:e2e:dev`.

## Quality gates

All gates must pass before merging.

```bash
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm test
pnpm run test:e2e  # builds the web export. YAZIO specs skip without credentials
```

Pre-commit, Husky runs `lint-staged` with eslint fix and prettier on staged files.

## Code conventions

- TypeScript `strict`. Use `import type` for type-only imports.
- SQLite booleans are `INTEGER` 0 or 1. Dates are `YYYY-MM-DD` keys with `toDateKey`.
- Screens live in `app`, UI in `src/components`, logic in `src/services`
  and `src/db`. Route files include no SQL or YAZIO calls.
- Styling uses gluestack-ui components with NativeWind classes. Design tokens live in
  `src/theme.ts`.
- Prettier with ESLint enforces the style with no semicolons and double quotes.

## Commits

Use Conventional Commits with a scope, for example `feat(diary): ...`, `fix(sync): ...`,
and `ci(workflows): ...`. Keep changes focused and reviewable.

## Tests

- Unit tests. Jest with jest-expo runs in `src/__tests__` with `pnpm test`.
  Pure `utils` functions and service logic with mocked DB modules are covered.
  Add tests for new pure logic.
- E2E. Playwright runs against the web export in `e2e` at phone viewport for
  local-first flows. YAZIO specs run only with credentials in `.env.local`.
- Schema changes. Add a case to `src/db/__tests__/database.test.ts` pinning the
  new migration SQL.
