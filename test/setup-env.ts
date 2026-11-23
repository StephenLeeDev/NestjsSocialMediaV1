/**
 * ============================================================================
 *  E2E test environment setup
 * ============================================================================
 *
 * Jest runs this file (configured as `setupFiles` in `test/jest-e2e.json`)
 * once per test file, BEFORE the test file itself and before any application
 * code is imported. That timing matters: the app reads its configuration from
 * `process.env`, so everything we set here is what the app will see.
 *
 * Goals of this file:
 *   1. Point the app at a dedicated TEST database, never the development one.
 *   2. Make the test configuration self-contained, so `npm run test:e2e` works
 *      without any extra `.env` file on a fresh machine or in CI.
 *   3. Keep files uploaded during tests out of the public `static/` folder.
 *
 * How the values interact with `.env`:
 *   - `@nestjs/config` loads `.env` with dotenv, and dotenv NEVER overrides a
 *     variable that already exists in `process.env`.
 *   - Because this file runs first, the values below always win over `.env`.
 *   - We use `??=` ("assign only if not already set") for connection settings,
 *     so a CI pipeline can still inject its own DB_HOST / DB_PASSWORD / etc.
 *     as real environment variables.
 */
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Lets application code detect that it is running under tests if it ever needs to.
process.env.NODE_ENV = 'test';

// ---------------------------------------------------------------------------
// Database connection
// ---------------------------------------------------------------------------
// Defaults match a local Postgres.app installation (port 5432, user "postgres").
// Postgres.app trusts local connections, so the password is not checked locally.
process.env.DB_HOST ??= 'localhost';
process.env.DB_PORT ??= '5432';
process.env.DB_USERNAME ??= 'postgres';
process.env.DB_PASSWORD ??= 'postgres';
process.env.DB_DATABASE ??= 'social-media-app-v1-test';

// Build the schema by running the MIGRATIONS (src/migrations) when the app
// starts, exactly as a real database gets it. So every e2e run also proves
// that the migrations produce a schema the code works with. (Until
// migrations were introduced, TypeORM's `synchronize` built it from the
// entity classes instead, which could hide a missing migration.)
process.env.DB_MIGRATIONS_RUN = 'true';

// Drop every table (including the "migrations" bookkeeping table) when the
// app starts, so the migrations above always run on an EMPTY database.
// Why: leftovers from an older commit (rows the current schema forbids, or a
// half-applied schema) would otherwise break the start, and every test would
// fail with a confusing connection error. Safe only because this is a "-test"
// database (see below).
process.env.DB_DROP_SCHEMA = 'true';

// SQL logging would bury the test output, so it is always off in tests.
process.env.DB_LOGGING = 'false';

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
// Any value works for tests; tokens are created and verified by the same app.
process.env.JWT_SECRET ??= 'e2e-test-secret';

// ---------------------------------------------------------------------------
// File uploads
// ---------------------------------------------------------------------------
// Used by the app to build image URLs; the exact host does not matter in tests.
process.env.SERVER_URL ??= 'http://localhost:3001';

// Uploaded images are written to a brand-new temporary folder instead of
// `static/images`. The OS cleans its temp directory up eventually, and the
// project folder stays free of test images.
// (The app reads UPLOAD_DIR in `src/lib/multerOptions.ts`.)
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'nest-e2e-uploads-'));

// ---------------------------------------------------------------------------
// Safety guard
// ---------------------------------------------------------------------------
// Every test file drops the whole schema on startup (DB_DROP_SCHEMA above) and
// empties ALL tables before it runs (see `resetDatabase` in
// `test/utils/test-app.ts`). If someone accidentally pointed DB_DATABASE at the
// development or production database, that data would be wiped.
// Refusing to run unless the name ends with "-test" makes that mistake impossible.
if (!process.env.DB_DATABASE.endsWith('-test')) {
  throw new Error(
    `E2E tests must use a database whose name ends with "-test" (got "${process.env.DB_DATABASE}")`,
  );
}
