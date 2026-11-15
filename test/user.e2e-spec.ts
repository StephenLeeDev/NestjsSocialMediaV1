/**
 * ============================================================================
 *  User e2e tests
 * ============================================================================
 *
 * Covers the `/user` endpoints used by the Flutter app's profile and search screens:
 *   - GET    /user                    : the signed-in user's own profile
 *   - GET    /user/:userEmail         : another user's profile (+ isFollowing)
 *   - PATCH  /user/statusMessage      : change the status message
 *   - POST   /user/post/bookmark      : bookmark / un-bookmark a post (toggle)
 *   - PATCH  /user/thumbnail          : upload a profile picture
 *   - DELETE /user/thumbnail          : reset the profile picture to the default
 *   - GET    /user/search/users       : search users by username
 *
 * Each test signs in with its OWN email address, so tests do not depend on data
 * created by other tests and can be read (and debugged) one by one.
 */
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bearer, createPost, createTestApp, resetDatabase, signIn, TEST_IMAGE } from './utils/test-app';

describe('User (e2e)', () => {
  let app: NestExpressApplication;
  // The in-memory HTTP server that supertest sends requests to.
  let server: ReturnType<NestExpressApplication['getHttpServer']>;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /user', () => {
    it("returns the current user's profile with zeroed counters", async () => {
      const token = await signIn(app, 'newbie@gmail.com', 'Newbie');

      const res = await request(server).get('/user').set(bearer(token)).expect(200);

      // `toEqual` checks the WHOLE response, so this test also documents the
      // exact shape the Flutter app receives for a brand-new account.
      expect(res.body).toEqual({
        email: 'newbie@gmail.com',
        username: 'Newbie',
        // New accounts get the bundled default picture.
        thumbnail: expect.stringContaining('/images/default/'),
        bookMarks: [],
        statusMessage: '',
        totalPostCount: 0,
        followerCount: 0,
        followingCount: 0,
      });
    });

    it('counts only the public posts of the user', async () => {
      const token = await signIn(app, 'writer@gmail.com');
      await createPost(app, token);
      await createPost(app, token);

      const res = await request(server).get('/user').set(bearer(token)).expect(200);

      expect(res.body.totalPostCount).toBe(2);
    });
  });

  describe('GET /user/:userEmail', () => {
    // NOTE: The route has a `:userEmail` path parameter, but the server actually
    // reads the email from the `userEmail` QUERY parameter. The Flutter app sends
    // it the same way, so the tests do too. Cleaning this up is a later,
    // coordinated API change (server + app together).

    it("returns another user's profile with the isFollowing flag", async () => {
      const token = await signIn(app, 'viewer@gmail.com');
      await signIn(app, 'target@gmail.com', 'Target');

      const res = await request(server)
        .get('/user/target@gmail.com')
        .query({ userEmail: 'target@gmail.com' })
        .set(bearer(token))
        .expect(200);

      // `toMatchObject` only checks the listed fields and ignores the rest.
      expect(res.body).toMatchObject({ email: 'target@gmail.com', username: 'Target', isFollowing: false });
    });

    it('returns 404 for an unknown user', async () => {
      const token = await signIn(app, 'viewer@gmail.com');

      await request(server)
        .get('/user/nobody@gmail.com')
        .query({ userEmail: 'nobody@gmail.com' })
        .set(bearer(token))
        .expect(404);
    });
  });

  describe('PATCH /user/statusMessage', () => {
    it('updates the status message', async () => {
      const token = await signIn(app, 'status@gmail.com');

      await request(server).patch('/user/statusMessage').set(bearer(token)).send({ statusMessage: 'Hello!' }).expect(200);

      // Read the profile back to prove the change was actually saved.
      const res = await request(server).get('/user').set(bearer(token)).expect(200);
      expect(res.body.statusMessage).toBe('Hello!');
    });
  });

  describe('POST /user/post/bookmark', () => {
    it('toggles a bookmark on and off', async () => {
      const token = await signIn(app, 'reader@gmail.com');
      const post = await createPost(app, token);

      // 1st call: the post is not bookmarked yet, so it gets bookmarked.
      await request(server).post('/user/post/bookmark').set(bearer(token)).send({ postId: post.id }).expect(201);
      let res = await request(server).get('/user').set(bearer(token)).expect(200);
      expect(res.body.bookMarks).toEqual([post.id]);

      // 2nd call with the same post: the bookmark is removed again.
      await request(server).post('/user/post/bookmark').set(bearer(token)).send({ postId: post.id }).expect(201);
      res = await request(server).get('/user').set(bearer(token)).expect(200);
      expect(res.body.bookMarks).toEqual([]);
    });
  });

  describe('thumbnail', () => {
    it('uploads a new thumbnail and resets it to the default', async () => {
      const token = await signIn(app, 'selfie@gmail.com');

      // The field name must be "file" (single-file upload).
      const uploaded = await request(server).patch('/user/thumbnail').set(bearer(token)).attach('file', TEST_IMAGE).expect(200);
      // The server renames uploads to "<timestamp>.<extension>".
      expect(uploaded.body.updatedThumbnail).toMatch(/\/images\/\d+\.jpeg$/);

      const reset = await request(server).delete('/user/thumbnail').set(bearer(token)).expect(200);
      expect(reset.body.updatedThumbnail).toContain('/images/default/');
    });
  });

  describe('GET /user/search/users', () => {
    it('finds other users by username keyword and excludes the current user', async () => {
      const token = await signIn(app, 'searcher@gmail.com', 'Searcher');
      await signIn(app, 'alice@gmail.com', 'Alice');
      await signIn(app, 'alicia@gmail.com', 'Alicia');
      await signIn(app, 'bob@gmail.com', 'Bob');

      // "Ali" matches Alice and Alicia, but not Bob or the searcher.
      const res = await request(server)
        .get('/user/search/users')
        .query({ keyword: 'Ali', page: 1, limit: 10 })
        .set(bearer(token))
        .expect(200);

      expect(res.body.total).toBe(2);
      // Sorted so the assertion does not depend on the order the server returns.
      expect(res.body.userList.map((user) => user.email).sort()).toEqual(['alice@gmail.com', 'alicia@gmail.com']);
    });
  });
});
