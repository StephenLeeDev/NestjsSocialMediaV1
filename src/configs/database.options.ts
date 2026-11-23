/**
 * ============================================================================
 *  Database connection options, shared by the app and the TypeORM CLI
 * ============================================================================
 *
 * Two programs connect to the database:
 *   - the NestJS app      (typeorm.config.ts → TypeOrmModule in app.module.ts)
 *   - the TypeORM CLI     (data-source.ts → `npm run migration:*` scripts)
 * Both build their options HERE, so they can never disagree about which
 * database, entities or migrations they use.
 *
 * SCHEMA CHANGES ONLY THROUGH MIGRATIONS
 *   `synchronize` is always OFF. It used to be on in development: the app
 *   compared the entity classes with the database at every start and
 *   changed the tables to match, silently. That once nearly deleted all likes
 *   and bookmarks (a renamed structure looked like "drop the old columns").
 *   Now every schema change is a migration file in src/migrations/:
 *   reviewed in a pull request, applied explicitly, recorded in the
 *   database's "migrations" table, and revertible. See src/migrations/README.md.
 *
 * Credentials come from environment variables (see .env.example) and are
 * never written here, because this file is committed to Git.
 */
import { DataSourceOptions } from 'typeorm';

/** Reads one setting by name; `undefined` when it is not set. */
export type SettingReader = (name: string) => string | undefined;

/**
 * Builds the connection options.
 *
 * @param read Where settings come from: ConfigService in the app,
 *             `process.env` in the CLI.
 * @throws Error when a required setting (DB_USERNAME, DB_PASSWORD,
 *         DB_DATABASE) is missing, so a misconfiguration fails at startup.
 */
export function buildDatabaseOptions(read: SettingReader): DataSourceOptions {
  const required = (name: string): string => {
    const value = read(name);
    if (value === undefined) {
      throw new Error(`Missing required environment variable ${name}`);
    }
    return value;
  };
  const flag = (name: string): boolean => read(name) === 'true';

  return {
    type: 'postgres',
    host: read('DB_HOST') ?? 'localhost',
    port: Number(read('DB_PORT') ?? '5432'),
    username: required('DB_USERNAME'),
    // May be empty: a local Postgres.app or the CI database accept
    // connections without a password ("trust").
    password: required('DB_PASSWORD'),
    database: required('DB_DATABASE'),

    // Every entity class (*.entity.ts / .js) in the project.
    entities: [__dirname + '/../**/*.entity.{js,ts}'],
    // Every migration in src/migrations (dist/migrations after `nest build`).
    // TypeORM skips the generated .d.ts files.
    migrations: [__dirname + '/../migrations/*.{js,ts}'],

    logging: flag('DB_LOGGING') ? 'all' : false,

    // Never: see "SCHEMA CHANGES ONLY THROUGH MIGRATIONS" above.
    synchronize: false,

    // Runs the pending migrations when the app connects. Only the e2e tests
    // turn this on (test/setup-env.ts), so they always test the schema the
    // migrations really produce. A real server runs `npm run migration:run`
    // as an explicit deployment step instead.
    migrationsRun: flag('DB_MIGRATIONS_RUN'),

    // Drops EVERY table before connecting. Only for the throwaway e2e test
    // database (test/setup-env.ts), so each run starts from an empty database
    // and the migrations build it from scratch.
    // NEVER enable this anywhere else: it deletes all data.
    dropSchema: flag('DB_DROP_SCHEMA'),
  };
}
