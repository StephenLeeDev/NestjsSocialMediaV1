/**
 * ============================================================================
 *  Follow e2e tests
 * ============================================================================
 *
 * Covers the `/follow` endpoints and how follows show up in user profiles:
 *   - POST   /follow                  : follow a user
 *   - GET    /follow/follower         : who follows a user
 *   - GET    /follow/following        : whom a user follows
 *   - DELETE /follow/following/cancel : unfollow a user
 *   - GET    /follow/isFollowing, /follow/follower/count, /follow/following/count
 *                                       (small helpers; not used by the app yet)
 *
 * The first block runs IN ORDER and tells one story with two users:
 *   1. "fan" follows "star"
 *   2. both profiles show the new counts
 *   3. the follower/following lists contain each other
 *   4. "fan" unfollows "star" and everything goes back to zero
 * The second block covers the edge cases, each with its own users.
 */
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bearer, createTestApp, resetDatabase, signIn } from './utils/test-app';

describe('Follow (e2e)', () => {
  let app: NestExpressApplication;
  // The in-memory HTTP server that supertest sends requests to.
  let server: ReturnType<NestExpressApplication['getHttpServer']>;
  let fanToken: string;
  let starToken: string;

  /**
   * Loads another user's profile as seen by the owner of `token`.
   * (The email goes into the `userEmail` query parameter; see the note in
   * `user.e2e-spec.ts` about this endpoint.)
   */
  const profileOf = (token: string, email: string) =>
    request(server)
      .get(`/user/${email}`)
      .query({ userEmail: email })
      .set(bearer(token))
      .expect(200);

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    await resetDatabase(app);
    fanToken = await signIn(app, 'fan@gmail.com', 'Fan');
    starToken = await signIn(app, 'star@gmail.com', 'Star');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('follow → lists → unfollow (one story, in order)', () => {
    it('POST /follow follows a user and returns their follower count', async () => {
      const res = await request(server)
        .post('/follow')
        .set(bearer(fanToken))
        .send({ email: 'star@gmail.com' })
        .expect(201);

      // `value` is the followed user's NEW follower count.
      expect(res.body).toEqual({ value: 1 });
    });

    it('reflects the follow in both profiles', async () => {
      // "star" now has one follower, and from fan's view isFollowing is true.
      const star = await profileOf(fanToken, 'star@gmail.com');
      expect(star.body).toMatchObject({
        followerCount: 1,
        followingCount: 0,
        isFollowing: true,
      });

      // "fan" now follows one user.
      const fan = await request(server)
        .get('/user')
        .set(bearer(fanToken))
        .expect(200);
      expect(fan.body).toMatchObject({ followerCount: 0, followingCount: 1 });
    });

    it('lists followers and followings', async () => {
      // star's followers → [fan]
      const followers = await request(server)
        .get('/follow/follower')
        .query({ email: 'star@gmail.com', page: 1, limit: 10 })
        .set(bearer(starToken))
        .expect(200);
      expect(followers.body.total).toBe(1);
      expect(followers.body.userList[0]).toMatchObject({
        email: 'fan@gmail.com',
        username: 'Fan',
      });

      // fan's followings → [star]
      const followings = await request(server)
        .get('/follow/following')
        .query({ email: 'fan@gmail.com', page: 1, limit: 10 })
        .set(bearer(fanToken))
        .expect(200);
      expect(followings.body.total).toBe(1);
      expect(followings.body.userList[0]).toMatchObject({
        email: 'star@gmail.com',
      });
    });

    it('DELETE /follow/following/cancel unfollows and returns the new follower count', async () => {
      const res = await request(server)
        .delete('/follow/following/cancel')
        .query({ email: 'star@gmail.com' })
        .set(bearer(fanToken))
        .expect(200);

      // Like POST /follow, `value` is star's follower count after the change.
      expect(res.body).toEqual({ value: 0 });
      const star = await profileOf(fanToken, 'star@gmail.com');
      expect(star.body).toMatchObject({ followerCount: 0, isFollowing: false });
    });
  });

  describe('edge cases', () => {
    /** Follows `email` as the owner of `token`. */
    const follow = (token: string, email?: string) =>
      request(server)
        .post('/follow')
        .set(bearer(token))
        .send(email === undefined ? {} : { email });

    it('returns 404 when the user to follow does not exist', async () => {
      // Previously this answered 201 and stored a follow row pointing at NULL.
      const token = await signIn(app, 'lonely@gmail.com');

      await follow(token, 'nobody@gmail.com').expect(404);
    });

    it('rejects following yourself', async () => {
      const token = await signIn(app, 'narcissus@gmail.com');

      await follow(token, 'narcissus@gmail.com').expect(400);
    });

    it('following the same user twice is harmless (no duplicate follow)', async () => {
      // Previously every call added another row, so the count went 1, 2, 3...
      const token = await signIn(app, 'eager@gmail.com');
      await signIn(app, 'idol@gmail.com');

      await follow(token, 'idol@gmail.com').expect(201);
      const second = await follow(token, 'idol@gmail.com').expect(201);

      expect(second.body).toEqual({ value: 1 });
    });

    it('rejects a request without a valid email', async () => {
      // Previously `findOneBy({ email: undefined })` → 500.
      const token = await signIn(app, 'sloppy@gmail.com');

      await follow(token).expect(400);
      await follow(token, 'not-an-email').expect(400);
    });

    it('unfollowing someone you do not follow changes nothing', async () => {
      const token = await signIn(app, 'stranger@gmail.com');
      await signIn(app, 'unknown-star@gmail.com');

      const res = await request(server)
        .delete('/follow/following/cancel')
        .query({ email: 'unknown-star@gmail.com' })
        .set(bearer(token))
        .expect(200);

      expect(res.body).toEqual({ value: 0 });
    });

    it('rejects unfollow and list requests without an email', async () => {
      const token = await signIn(app, 'sloppy@gmail.com');

      await request(server)
        .delete('/follow/following/cancel')
        .set(bearer(token))
        .expect(400);
      await request(server)
        .get('/follow/follower')
        .query({ page: 1, limit: 10 })
        .set(bearer(token))
        .expect(400);
    });

    it('lists the newest followers first', async () => {
      // Without an ORDER BY the database may return any order, so paging
      // through a long list could repeat or skip people.
      await signIn(app, 'popular@gmail.com');
      for (const name of ['first', 'second', 'third']) {
        const token = await signIn(app, `${name}-fan@gmail.com`);
        await follow(token, 'popular@gmail.com').expect(201);
      }
      const token = await signIn(app, 'popular@gmail.com');

      const res = await request(server)
        .get('/follow/follower')
        .query({ email: 'popular@gmail.com', page: 1, limit: 10 })
        .set(bearer(token))
        .expect(200);

      expect(res.body.userList.map((user) => user.email)).toEqual([
        'third-fan@gmail.com',
        'second-fan@gmail.com',
        'first-fan@gmail.com',
      ]);
    });

    it('answers the small helper endpoints with JSON objects', async () => {
      // These used to return a bare `true` / `1`. A bare value is not a JSON
      // object, so clients could not read it like the other responses (supertest
      // even parsed it as {}), and no field could ever be added to it.
      const token = await signIn(app, 'helper@gmail.com');
      await signIn(app, 'helped@gmail.com');
      await follow(token, 'helped@gmail.com').expect(201);

      const isFollowing = await request(server)
        .get('/follow/isFollowing')
        .query({ email: 'helped@gmail.com' })
        .set(bearer(token))
        .expect(200);
      expect(isFollowing.body).toEqual({ isFollowing: true });

      const followingCount = await request(server)
        .get('/follow/following/count')
        .set(bearer(token))
        .expect(200);
      expect(followingCount.body).toEqual({ value: 1 });

      const followerCount = await request(server)
        .get('/follow/follower/count')
        .set(bearer(token))
        .expect(200);
      expect(followerCount.body).toEqual({ value: 0 });
    });
  });
});
