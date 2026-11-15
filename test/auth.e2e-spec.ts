/**
 * ============================================================================
 *  Auth e2e tests
 * ============================================================================
 *
 * Covers:
 *   - POST /auth/signin : sign-in that also creates the account on first use
 *   - The JWT guard     : how protected routes react to missing/invalid/valid tokens
 *
 * How these tests work:
 *   The whole NestJS app is started in memory (`createTestApp`) against the test
 *   database, and `supertest` sends real HTTP requests to it. Nothing is mocked,
 *   so a passing test means the endpoint really behaves this way for the
 *   Flutter app as well.
 */
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bearer, createTestApp, resetDatabase } from './utils/test-app';

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;
  // The in-memory HTTP server that supertest sends requests to.
  let server: ReturnType<NestExpressApplication['getHttpServer']>;

  // Start the app once for this file and begin with an empty database.
  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    await resetDatabase(app);
  });

  // Close the app so the database connection is released and Jest can exit.
  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/signin', () => {
    // The tests in this block run in order and share this one account:
    // the first test creates it, the following ones sign into it again.
    const credentials = {
      username: 'John',
      socialType: 'GOOGLE',
      email: 'john@gmail.com',
    };

    it('creates the account on first sign-in and returns an access token', async () => {
      const res = await request(server)
        .post('/auth/signin')
        .send(credentials)
        .expect(201);

      // The response contains only the token (the Flutter app stores it).
      expect(res.body).toEqual({ accessToken: expect.any(String) });
    });

    it('signs an existing account in again', async () => {
      const res = await request(server)
        .post('/auth/signin')
        .send(credentials)
        .expect(201);

      expect(res.body.accessToken).toEqual(expect.any(String));
    });

    it('rejects an existing email registered with a different social type', async () => {
      // "john@gmail.com" was registered with GOOGLE above, so signing in with
      // another provider for the same email is a conflict (HTTP 409).
      await request(server)
        .post('/auth/signin')
        .send({ ...credentials, socialType: 'APPLE' })
        .expect(409);
    });

    it('rejects a request with missing fields', async () => {
      // `email` and `socialType` are missing. The ValidationPipe on this endpoint
      // checks the DTO (`AuthCredentialsDto`) and answers 400 Bad Request.
      await request(server)
        .post('/auth/signin')
        .send({ username: 'John' })
        .expect(400);
    });
  });

  describe('JWT guard', () => {
    // `GET /user` is used as a representative protected route: every controller
    // except auth uses the same `AuthGuard()`, so this covers them all.

    it('rejects protected routes without a token', async () => {
      await request(server).get('/user').expect(401);
    });

    it('rejects an invalid token', async () => {
      await request(server)
        .get('/user')
        .set(bearer('not-a-real-token'))
        .expect(401);
    });

    it('accepts the token returned by sign-in', async () => {
      const { body } = await request(server)
        .post('/auth/signin')
        .send({
          username: 'Kate',
          socialType: 'GOOGLE',
          email: 'kate@gmail.com',
        })
        .expect(201);

      const res = await request(server)
        .get('/user')
        .set(bearer(body.accessToken))
        .expect(200);

      // The guard resolved the token back to the right user.
      expect(res.body.email).toBe('kate@gmail.com');
    });
  });
});
