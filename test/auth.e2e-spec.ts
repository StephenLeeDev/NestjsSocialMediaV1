/**
 * ============================================================================
 *  Auth e2e tests
 * ============================================================================
 *
 * Covers:
 *   - POST /auth/signin     : sign-in that also creates the account on first use
 *   - POST /auth/test       : one-tap sign-in as the shared "testUser" account
 *   - POST /auth/test/dummy : creates the 10 development dummy users
 *   - The JWT guard         : how protected routes react to missing, invalid,
 *                             valid and "orphaned" tokens
 *
 * How these tests work:
 *   The whole NestJS app is started in memory (`createTestApp`) against the test
 *   database, and `supertest` sends real HTTP requests to it. Nothing is mocked,
 *   so a passing test means the endpoint really behaves this way for the
 *   Flutter app as well.
 */
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { User } from '../src/user/user.entity';
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

  /** Number of rows in the user table (to check that nothing was created twice). */
  const countUsers = (where: Partial<User> = {}) =>
    app.get(DataSource).getRepository(User).countBy(where);

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

    it('signs an existing account in again without creating a second one', async () => {
      const res = await request(server)
        .post('/auth/signin')
        .send(credentials)
        .expect(201);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(await countUsers({ email: credentials.email })).toBe(1);
    });

    it('rejects a social type the server does not support', async () => {
      // Only GOOGLE sign-in exists. Before this refactor any text was accepted
      // here, so a typo like "GOOGEL" created an account with a social type
      // nobody could ever sign in with again. Now the DTO rejects it (400).
      await request(server)
        .post('/auth/signin')
        .send({ ...credentials, socialType: 'APPLE' })
        .expect(400);
    });

    it('rejects a request with missing fields', async () => {
      // `email` and `socialType` are missing. The global ValidationPipe checks
      // the DTO (`AuthCredentialsDto`) and answers 400 Bad Request.
      await request(server)
        .post('/auth/signin')
        .send({ username: 'John' })
        .expect(400);
    });

    it('rejects an email that is not an email address', async () => {
      await request(server)
        .post('/auth/signin')
        .send({ ...credentials, email: 'not-an-email' })
        .expect(400);
    });

    it('rejects an empty username', async () => {
      await request(server)
        .post('/auth/signin')
        .send({ ...credentials, email: 'empty@gmail.com', username: '' })
        .expect(400);
    });

    it('handles simultaneous first sign-ins of the same new account', async () => {
      // The Flutter app can fire the sign-in request twice (e.g. a double tap).
      // Before this refactor both requests could see "no account yet", both
      // tried to INSERT, and the loser of that race failed with 409 Conflict.
      // Now the account is inserted with "ON CONFLICT DO NOTHING", so every
      // request succeeds and exactly one account exists afterwards.
      //
      // HONEST LIMITATION: this test also passed with the old code. The race
      // window (between "look up" and "insert") is too short to hit reliably
      // in this test environment, just like the chat-room lock test in
      // chat.e2e-spec.ts. It is kept as a check of the end result ("exactly
      // one account, every request answered 201"), not as proof of the fix.
      const newcomer = {
        username: 'Racer',
        socialType: 'GOOGLE',
        email: 'racer@gmail.com',
      };
      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(server).post('/auth/signin').send(newcomer),
        ),
      );

      expect(responses.map((res) => res.status)).toEqual([
        201, 201, 201, 201, 201,
      ]);
      expect(await countUsers({ email: newcomer.email })).toBe(1);
    });
  });

  describe('POST /auth/test', () => {
    it('signs in as the shared test user, creating it the first time', async () => {
      // Called twice: the first call creates "testUser", the second reuses it.
      for (let i = 0; i < 2; i++) {
        const { body } = await request(server).post('/auth/test').expect(201);

        // The token belongs to the test user.
        const profile = await request(server)
          .get('/user')
          .set(bearer(body.accessToken))
          .expect(200);
        expect(profile.body.email).toBe('testUser@gmail.com');
      }

      expect(await countUsers({ email: 'testUser@gmail.com' })).toBe(1);
    });
  });

  describe('POST /auth/test/dummy', () => {
    // The tests in this block run in order: the first one creates a REAL
    // account whose email is also one of the dummy emails, then runs the
    // dummy endpoint.

    it('does not overwrite a real account that has a dummy email', async () => {
      // A real person signed up as "rose@gmail.com" before anyone created
      // the dummy users.
      await request(server)
        .post('/auth/signin')
        .send({
          username: 'Real Rose',
          socialType: 'GOOGLE',
          email: 'rose@gmail.com',
        })
        .expect(201);

      await request(server).post('/auth/test/dummy').expect(201);

      // Before this refactor the dummy run used TypeORM's `save()`, which
      // UPDATES a row when the primary key (email) already exists. So the
      // real Rose silently got the dummy name, picture and status message.
      // Now dummy users are inserted with "ON CONFLICT DO NOTHING".
      const rose = await app
        .get(DataSource)
        .getRepository(User)
        .findOneByOrFail({ email: 'rose@gmail.com' });
      expect(rose.username).toBe('Real Rose');
      expect(rose.statusMessage).toBe('');
    });

    it('creates the 10 dummy users and can be called again safely', async () => {
      // The previous test already ran the endpoint once; run it again.

      // Every dummy user exists exactly once.
      const dummyEmails = [
        'mike',
        'ash',
        'jack',
        'kate',
        'max',
        'rose',
        'john',
        'smith',
        'susan',
        'sam',
      ].map((name) => `${name}@gmail.com`);
      const repo = app.get(DataSource).getRepository(User);
      for (const email of dummyEmails) {
        expect(await repo.countBy({ email })).toBe(1);
      }
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

    it('rejects a correctly signed token whose user no longer exists', async () => {
      // The signature is valid (same secret as the server), but no account
      // with this email exists, so the guard must still answer 401.
      const token = await app
        .get(JwtService)
        .signAsync({ email: 'ghost@gmail.com' });

      await request(server).get('/user').set(bearer(token)).expect(401);
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
