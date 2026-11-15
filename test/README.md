# E2E tests

End-to-end (e2e) tests start the **whole NestJS app** in memory and send real HTTP
requests to it with [supertest](https://github.com/ladjs/supertest), against a real
PostgreSQL database. Nothing is mocked, so a passing test means the endpoint really
behaves that way for the Flutter app.

They are the safety net for refactoring: internal code can be restructured freely
as long as these tests keep passing.

## Running

```bash
npm run test:e2e                 # all e2e tests
npm run test:e2e -- test/post    # only files whose path matches "test/post"
```

Requirements:

- PostgreSQL running locally on port 5432 (e.g. Postgres.app)
- A database named `social-media-app-v1-test`:

  ```bash
  createdb -h localhost -U postgres social-media-app-v1-test
  ```

No `.env` file is needed; all test settings live in [`setup-env.ts`](./setup-env.ts).
To use another database server (e.g. in CI), set `DB_HOST`, `DB_PORT`, `DB_USERNAME`,
`DB_PASSWORD` and `DB_DATABASE` as real environment variables.

> **Safety:** every test file empties all tables before it runs. To make wiping the
> wrong database impossible, the tests refuse to start unless the database name
> ends with `-test`.

## Files

| File | Purpose |
|---|---|
| `jest-e2e.json` | Jest configuration for the e2e tests (see below) |
| `tsconfig.json` | TypeScript settings for compiling `src/` and `test/` together |
| `setup-env.ts` | Sets the test environment variables before any app code loads |
| `utils/test-app.ts` | Shared helpers: start the app, reset the DB, sign in, create posts/comments |
| `*.e2e-spec.ts` | The tests, one file per feature (auth, user, post, comment, follow, chat) |

## `jest-e2e.json` explained

JSON files cannot contain comments, so the settings are explained here:

| Setting | Why |
|---|---|
| `"testRegex": ".e2e-spec.ts$"` | Only files ending in `.e2e-spec.ts` are e2e tests |
| `"transform"` → `ts-jest` with `test/tsconfig.json` | Compiles TypeScript on the fly, using the same options as the app |
| `"setupFiles": ["setup-env.ts"]` | Runs before each test file, so the app sees the test configuration |
| `"maxWorkers": 1` | All test files share one database, so they must run one after another |
| `"testTimeout": 20000` | Starting the app and connecting to the DB can take a few seconds |

## Why `node --experimental-vm-modules`?

NestJS 12 packages are published as ES modules (ESM), while this project compiles
to CommonJS. Jest can only load ES modules from CommonJS code when Node's
`--experimental-vm-modules` flag is on. The `npm run test*` scripts in
`package.json` add the flag for you (this is also what the official NestJS 12
project template does). You may see an `ExperimentalWarning` about it; that is expected.

## Writing a new test

1. Create users with `signIn(app, 'someone@gmail.com')` (accounts are created on first sign-in).
2. Create data through the API helpers (`createPost`, `createComment`) or with `request(server)`.
3. Prefer a fresh user / post per test, so each test can be read and run on its own.
4. Assert on what the client sees: the HTTP status and the response body.
