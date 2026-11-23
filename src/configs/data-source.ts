/**
 * ============================================================================
 *  The DataSource the TypeORM CLI uses (`npm run migration:*`)
 * ============================================================================
 *
 * The CLI runs outside NestJS, so there is no ConfigModule to load `.env`.
 * Node's built-in `process.loadEnvFile` does that job here. It never
 * overrides variables that are already set, so a one-off override works:
 *
 *   DB_DATABASE=other-db npm run migration:show
 *
 * The CLI loads the COMPILED file (dist/configs/data-source.js); that is why
 * every migration script builds first. See package.json and
 * src/migrations/README.md.
 */
import { existsSync } from 'fs';
import { DataSource } from 'typeorm';
import { buildDatabaseOptions } from './database.options';

// No .env in CI: there the variables come from the workflow environment.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// The CLI expects exactly one exported DataSource.
export default new DataSource(
  buildDatabaseOptions((name) => process.env[name]),
);
