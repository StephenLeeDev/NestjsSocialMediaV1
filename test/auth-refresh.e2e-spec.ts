/**
 * ============================================================================
 *  Refresh token e2e tests
 * ============================================================================
 *
 * Covers:
 *   - POST /auth/signin, /auth/test : now also return a refresh token
 *   - POST /auth/refresh            : trade a refresh token for a NEW pair
 *   - POST /auth/logout             : end the session of a refresh token
 *
 * The idea in one paragraph:
 *   The access token (a JWT) is sent with every request, so it should live
 *   only briefly: if it leaks, it stops working soon. The refresh token is
 *   sent ONLY to /auth/refresh, lives much longer, and gets the app a new
 *   access token without asking the user to sign in again. Every refresh
 *   REPLACES the refresh token ("rotation"); presenting an already replaced
 *   token means someone kept a copy, so the whole session is ended
 *   ("reuse detection").
 */
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bearer, createTestApp, resetDatabase } from './utils/test-app';

describe('Refresh tokens (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<NestExpressApplication['getHttpServer']>;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Signs `email` in and returns both tokens. */
  const signIn = async (email: string) => {
    const res = await request(server)
      .post('/auth/signin')
      .send({ username: email.split('@')[0], socialType: 'GOOGLE', email })
      .expect(201);
    return res.body as { accessToken: string; refreshToken: string };
  };

  /** POST /auth/refresh with the given token (not checking the status). */
  const refresh = (refreshToken: unknown) =>
    request(server).post('/auth/refresh').send({ refreshToken });

  /** Whether the access token is accepted by a protected route. */
  const accessWorks = async (accessToken: string) =>
    (await request(server).get('/user').set(bearer(accessToken))).status ===
    200;

  describe('sign-in', () => {
    it('returns an access token AND a refresh token', async () => {
      const tokens = await signIn('pair@gmail.com');

      expect(tokens).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });
      // The two are different kinds of token: the refresh token is not a JWT.
      expect(tokens.refreshToken).not.toBe(tokens.accessToken);
      expect(tokens.refreshToken.split('.')).toHaveLength(1);
    });

    it('also returns both tokens from POST /auth/test', async () => {
      const res = await request(server).post('/auth/test').expect(201);
      expect(res.body).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });
    });

    it('stores only a HASH of the refresh token in the database', async () => {
      const { refreshToken } = await signIn('hashed@gmail.com');

      // A database leak must not hand out working refresh tokens.
      const rows: { tokenHash: string }[] = await app
        .get(DataSource)
        .query(`SELECT "tokenHash" FROM refresh_token WHERE "userEmail" = $1`, [
          'hashed@gmail.com',
        ]);
      expect(rows).toHaveLength(1);
      expect(rows[0].tokenHash).not.toBe(refreshToken);
      expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/); // SHA-256, hex
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns a new pair; the new access token works', async () => {
      const first = await signIn('rotate@gmail.com');

      const res = await refresh(first.refreshToken).expect(200);

      expect(res.body).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });
      // Rotation: the refresh token is replaced on every use.
      expect(res.body.refreshToken).not.toBe(first.refreshToken);
      expect(await accessWorks(res.body.accessToken)).toBe(true);
    });

    it('can keep refreshing with each NEW refresh token', async () => {
      let { refreshToken } = await signIn('chain@gmail.com');

      for (let i = 0; i < 3; i++) {
        const res = await refresh(refreshToken).expect(200);
        refreshToken = res.body.refreshToken;
      }
    });

    it('ends the whole session when a replaced token is used again', async () => {
      const first = await signIn('reuse@gmail.com');
      const second = (await refresh(first.refreshToken).expect(200)).body;

      // Someone presents the OLD token again (e.g. a stolen copy) → 401 ...
      await refresh(first.refreshToken).expect(401);

      // ... and because we cannot tell who is the real user, the CURRENT
      // token of that session stops working too. Both parties must sign in.
      await refresh(second.refreshToken).expect(401);
    });

    it('does not affect other sessions of the same user', async () => {
      // Two devices = two sign-ins = two independent sessions.
      const phone = await signIn('two-devices@gmail.com');
      const tablet = await signIn('two-devices@gmail.com');

      const phoneNext = (await refresh(phone.refreshToken).expect(200)).body;
      await refresh(phone.refreshToken).expect(401); // reuse on the phone

      await refresh(phoneNext.refreshToken).expect(401); // phone session ended
      await refresh(tablet.refreshToken).expect(200); // tablet unaffected
    });

    it('lets exactly ONE of several simultaneous refreshes with the same token win', async () => {
      // The guarantee comes from RefreshTokenRepository.revokeIfActive:
      // "UPDATE ... WHERE id = ? AND revokedAt IS NULL" lets only one request
      // revoke the token; the others are treated as reuse.
      //
      // HONEST LIMITATION: this test ALSO passed when that condition was
      // removed on purpose. The requests do not overlap closely enough in
      // this test environment to hit the race (the same happened with the
      // chat-room lock and the sign-in race tests). It checks the end result,
      // not the atomic guard; the guard is covered by a unit test of the
      // service ("a parallel request was faster").
      const { refreshToken } = await signIn('race@gmail.com');

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => refresh(refreshToken)),
      );

      const statuses = responses.map((res) => res.status).sort();
      expect(statuses).toEqual([200, 401, 401, 401, 401]);
    });

    it('rejects an expired refresh token', async () => {
      const { refreshToken } = await signIn('expired@gmail.com');
      // Let the token expire by moving its expiry into the past.
      await app.get(DataSource).query(
        `UPDATE refresh_token SET "expiresAt" = now() - interval '1 second'
           WHERE "userEmail" = $1`,
        ['expired@gmail.com'],
      );

      await refresh(refreshToken).expect(401);
    });

    it('rejects an unknown token with 401 and a missing one with 400', async () => {
      await refresh('not-a-real-refresh-token').expect(401);
      await refresh(undefined).expect(400);
      await refresh('').expect(400);
    });

    it('does not accept an ACCESS token as a refresh token', async () => {
      const { accessToken } = await signIn('mixup@gmail.com');
      await refresh(accessToken).expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('ends the session: its refresh token stops working', async () => {
      const { refreshToken } = await signIn('logout@gmail.com');

      await request(server)
        .post('/auth/logout')
        .send({ refreshToken })
        .expect(204);

      await refresh(refreshToken).expect(401);
    });

    it('is harmless to repeat, and for unknown tokens', async () => {
      const { refreshToken } = await signIn('logout-twice@gmail.com');

      for (const token of [refreshToken, refreshToken, 'unknown-token']) {
        await request(server)
          .post('/auth/logout')
          .send({ refreshToken: token })
          .expect(204);
      }
    });
  });
});
