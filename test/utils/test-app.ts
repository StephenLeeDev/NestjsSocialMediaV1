/**
 * ============================================================================
 *  Shared helpers for the e2e tests
 * ============================================================================
 *
 * Every `*.e2e-spec.ts` file uses these helpers so that the tests read like
 * short stories ("sign in, create a post, delete it, expect 404") instead of
 * repeating HTTP boilerplate everywhere.
 *
 * Contents:
 *   - TEST_IMAGE      : a real JPEG file used for upload tests
 *   - createTestApp() : boots the whole NestJS app in memory
 *   - resetDatabase() : empties every table so each test file starts clean
 *   - bearer()        : builds the Authorization header for a token
 *   - signIn()        : creates/signs in a user and returns their JWT
 *   - createPost()    : creates a post through the real API
 *   - createComment() : creates a comment (or a reply) through the real API
 *
 * Why the helpers go through the HTTP API instead of inserting rows directly:
 *   E2E tests should treat the server as a black box, exactly like the Flutter
 *   app does. Creating data via the API also exercises those endpoints, and the
 *   helpers keep working even if the database schema changes during refactors.
 */
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';

/**
 * Path to a small JPEG that ships with the repository (one of the dummy images).
 * Used whenever a test needs to upload a file (post images, profile thumbnail).
 */
export const TEST_IMAGE = join(__dirname, '..', '..', 'static', 'images', 'dummy', '1.jpeg');

/**
 * Boots the REAL application (the same `AppModule` that `main.ts` uses) for tests.
 *
 * - `Test.createTestingModule` compiles the module graph exactly like production,
 *   but gives us a chance to override providers later if a test ever needs it.
 * - `configureApp` applies the same Swagger / static files / WebSocket setup as
 *   `main.ts`, so tests run against the same configuration as the real server.
 * - `app.init()` starts everything (including the database connection) WITHOUT
 *   listening on a network port; supertest talks to the in-memory HTTP server.
 *
 * Logging is limited to errors: normal request logs would flood the test output,
 * but unexpected server errors should still be visible while debugging.
 *
 * The database used is configured in `test/setup-env.ts`.
 */
export async function createTestApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: ['error'] });
  configureApp(app);
  await app.init();
  return app;
}

/**
 * Deletes ALL rows from ALL tables so a test file starts from an empty database.
 *
 * - The table list comes from TypeORM's entity metadata, so new entities are
 *   included automatically without updating this helper.
 * - `TRUNCATE` is much faster than `DELETE` for wiping whole tables.
 * - `RESTART IDENTITY` resets auto-increment ids back to 1, which keeps ids
 *   predictable between runs.
 * - `CASCADE` lets Postgres truncate tables that reference each other via
 *   foreign keys in a single statement.
 *
 * Safety: `test/setup-env.ts` refuses to run unless the database name ends
 * with "-test", so this can never wipe the development database.
 */
export async function resetDatabase(app: NestExpressApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  const tables = dataSource.entityMetadatas.map((meta) => `"${meta.tableName}"`).join(', ');
  await dataSource.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

/**
 * Builds the `Authorization` header the JWT guard expects.
 *
 * Usage: `request(server).get('/user').set(bearer(token))`
 */
export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/**
 * Signs a user in and returns their access token (JWT).
 *
 * The server's `/auth/signin` endpoint creates the account automatically on the
 * first sign-in, so calling this with a new email is also how tests create users.
 *
 * @param email    The user's email; it is the user's primary key on the server.
 * @param username Display name. Defaults to the part of the email before "@"
 *                 (e.g. "john" for "john@gmail.com") when a test doesn't care.
 */
export async function signIn(
  app: NestExpressApplication,
  email: string,
  username = email.split('@')[0],
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/signin')
    .send({ username, socialType: 'GOOGLE', email })
    .expect(201);
  return res.body.accessToken;
}

/**
 * Creates a post with one uploaded image and returns the API response body.
 *
 * The request is `multipart/form-data`, exactly like the Flutter app sends it:
 *   - `description` is a normal text field
 *   - `files` is the image field (the server accepts up to 4 of them)
 *
 * `.expect(201)` makes the calling test fail immediately with a clear message
 * if creating the post fails, instead of failing later in a confusing way.
 */
export async function createPost(app: NestExpressApplication, token: string, description = 'A test post') {
  const res = await request(app.getHttpServer())
    .post('/post')
    .set(bearer(token))
    .field('description', description)
    .attach('files', TEST_IMAGE)
    .expect(201);
  return res.body;
}

/**
 * Creates a comment on a post and returns the API response body.
 *
 * Pass `parent` to create a REPLY instead of a top-level comment:
 *   - `parent.id`          → sent as `parentCommentId`
 *   - `parent.authorEmail` → sent as `parentCommentAuthor`
 *     (the API requires the parent author's email for replies)
 *
 * Example:
 *   const comment = await createComment(app, token, postId, 'Nice!');
 *   const reply   = await createComment(app, token, postId, 'Thanks',
 *                                      { id: comment.id, authorEmail: 'me@gmail.com' });
 */
export async function createComment(
  app: NestExpressApplication,
  token: string,
  postId: number,
  content = 'A comment',
  parent?: { id: number; authorEmail: string },
) {
  const res = await request(app.getHttpServer())
    .post('/comment')
    .set(bearer(token))
    .send({
      content,
      postId,
      // Only add the reply fields when a parent is given; spreading `undefined`
      // (when `parent` is missing) adds nothing to the object.
      ...(parent && { parentCommentId: parent.id, parentCommentAuthor: parent.authorEmail }),
    })
    .expect(201);
  return res.body;
}
