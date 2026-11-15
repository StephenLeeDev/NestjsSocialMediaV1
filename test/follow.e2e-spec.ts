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
 *
 * The tests in this file run IN ORDER and tell one story with two users:
 *   1. "fan" follows "star"
 *   2. both profiles show the new counts
 *   3. the follower/following lists contain each other
 *   4. "fan" unfollows "star" and everything goes back to zero
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
    request(server).get(`/user/${email}`).query({ userEmail: email }).set(bearer(token)).expect(200);

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

  it('POST /follow follows a user and returns their follower count', async () => {
    const res = await request(server).post('/follow').set(bearer(fanToken)).send({ email: 'star@gmail.com' }).expect(201);

    // `value` is the followed user's NEW follower count.
    expect(res.body).toEqual({ value: 1 });
  });

  it('reflects the follow in both profiles', async () => {
    // "star" now has one follower, and from fan's view isFollowing is true.
    const star = await profileOf(fanToken, 'star@gmail.com');
    expect(star.body).toMatchObject({ followerCount: 1, followingCount: 0, isFollowing: true });

    // "fan" now follows one user.
    const fan = await request(server).get('/user').set(bearer(fanToken)).expect(200);
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
    expect(followers.body.userList[0]).toMatchObject({ email: 'fan@gmail.com', username: 'Fan' });

    // fan's followings → [star]
    const followings = await request(server)
      .get('/follow/following')
      .query({ email: 'fan@gmail.com', page: 1, limit: 10 })
      .set(bearer(fanToken))
      .expect(200);
    expect(followings.body.total).toBe(1);
    expect(followings.body.userList[0]).toMatchObject({ email: 'star@gmail.com' });
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
