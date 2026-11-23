# Database migrations

Every change to the database schema is a **migration**: a TypeScript file in
this folder with an `up()` (apply the change) and a `down()` (undo it).
The database records which migrations it has run in its `migrations` table,
so `npm run migration:run` applies exactly the ones still missing, in order.

TypeORM's `synchronize` (which silently changed tables at every app start) is
switched off for good; see `src/configs/database.options.ts` for why.

## Everyday commands

All scripts build the project first, because the TypeORM CLI loads the
compiled `dist/configs/data-source.js`. They read `.env` like the app does.

| Command | What it does |
|---|---|
| `npm run migration:show` | Lists all migrations; `[X]` = applied, `[ ]` = pending |
| `npm run migration:run` | Applies every pending migration |
| `npm run migration:revert` | Undoes the LAST applied migration (run again to go further back) |
| `npm run migration:generate --name=AddSomething` | Compares the entities with the database and writes the SQL that is missing into a new file here |
| `npm run migration:create --name=FixSomething` | Creates an EMPTY migration, for changes the generator cannot see (data updates, extensions, ...) |
| `npm run migration:check` | Fails if the entities and the database differ (CI runs this) |

To run a command against another database, override the variable:
`DB_DATABASE=other-db npm run migration:show` (values from the shell win over `.env`).

## Changing the schema, step by step

1. Change the entity classes.
2. Make sure your local database has all existing migrations:
   `npm run migration:run`.
3. Generate the migration: `npm run migration:generate --name=AddPostTitle`.
4. **Read the generated file.** The generator only compares structures. It
   cannot tell a *rename* from "drop the old column, add a new one", which
   would delete data. Rewrite such statements by hand (e.g. `RENAME COLUMN`,
   or add a step that copies the data first), and add comments, like the rest
   of the code.
5. Apply it locally (`npm run migration:run`), run the tests, and check that
   `npm run migration:revert` really undoes it.
6. Commit the migration together with the entity change. CI then:
   - builds a fresh database from ALL migrations and checks that it matches
     the entities (`migration:check`),
   - runs the e2e tests on a database built by the migrations.

**Never edit a migration that has already been applied somewhere** (merged
into `develop`). Databases that ran it would not run it again; write a new
migration instead.

## Existing databases (created before migrations existed)

Databases created by `synchronize` already contain every table of the first
migration, `InitialSchema`. Running it would fail ("table already exists").
Record it as applied WITHOUT running it, once:

```bash
npm run migration:check            # must say: No changes in database schema were found
npm run migration:run -- --fake    # marks InitialSchema as applied
npm run migration:show             # [X] 1 InitialSchema...
```

`migration:check` comes first on purpose: `--fake` is only correct if the
database really matches the baseline. (The local development database was
switched over this way on 2026-11-24; the check reported no differences.)

## History

Before this baseline, two one-off SQL scripts converted existing data by hand
(likes/bookmarks from arrays to join tables, image URLs to paths). They are in
the Git history under `database/migrations/`; every database that exists
today has already run them, and the baseline describes the schema after them.
