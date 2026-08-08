# Contributing

Dietinator is a personal, local-first calorie tracker. Pull requests and issues
are welcome — a few ground rules keep the project healthy:

## Ground rules

- **Local-first always.** The diary must keep working with no network. Never
  let a YAZIO failure block a local write, and keep the offline e2e suite green
  (`npm run test:e2e`).
- **No ads, no tracking, no analytics SDKs.** Error monitoring and metrics
  must be opt-in and privacy-preserving.
- **Respect the unofficial API.** The `yazio` npm package is a reverse-engineered
  client of an API we do not own. Do not productize, redistribute, or abuse it.
  Changes to the integration must keep the local paths intact — the API can
  break without notice.
- **No secrets in the repo.** Credentials, tokens and `.env` files never get
  committed. CI runs a gitleaks secret scan on every push.

## Development setup

```bash
nvm use
npm install
npm start          # Metro + Expo (use the wrapper script, never raw npx expo)
```

Web iteration loop: `npm run dev:web` + `npm run test:e2e:dev`.

## Quality gates (all must pass before merging)

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:e2e   # builds the web export; YAZIO specs skip without credentials
```

Pre-commit, `husky` runs `lint-staged` (eslint --fix + prettier) on staged files.

## Code conventions

- TypeScript `strict`; `import type` for type-only imports.
- SQLite booleans are `INTEGER` 0/1; dates are `YYYY-MM-DD` keys
  (`toDateKey`).
- Screens live in `app/`, UI in `src/components/`, logic in `src/services/`
  and `src/db/` — no SQL or YAZIO calls in route files.
- Styling via gluestack-ui components + NativeWind classes; design tokens in
  `src/theme.ts`.
- Prettier + ESLint keep the style; no semicolons, double quotes.

## Commits

Conventional Commits with a scope, e.g. `feat(diary): ...`, `fix(sync): ...`,
`ci(workflows): ...`. Keep changes focused and reviewable.

## Tests

- Unit tests: Jest + jest-expo in `src/**/__tests__/` (`npm test`).
  Pure `utils/` functions and service logic with mocked DB modules are covered;
  add tests for new pure logic.
- E2E: Playwright against the web export in `e2e/` (phone viewport,
  local-first flows; YAZIO specs run only with credentials in `.env.local`).
- Schema changes: add a case to `src/db/__tests__/database.test.ts` pinning the
  new migration SQL.
