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
import {
  bearer,
  createPost,
  createTestApp,
  resetDatabase,
  signIn,
  TEST_IMAGE,
} from './utils/test-app';

/**
 * Full URL of the bundled default profile picture, built from the SAME
 * SERVER_URL the app uses (set in test/setup-env.ts). Asserting the exact URL
 * proves the server builds it from configuration instead of a hard-coded IP.
 * (The file name really is spelled "dafault"; it is kept for compatibility
 * with URLs already stored in the database.)
 */
const DEFAULT_THUMBNAIL_URL = `${process.env.SERVER_URL}/images/default/dafault_thumbnail.png`;

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

      const res = await request(server)
        .get('/user')
        .set(bearer(token))
        .expect(200);

      // `toEqual` checks the WHOLE response, so this test also documents the
      // exact shape the Flutter app receives for a brand-new account.
      expect(res.body).toEqual({
        email: 'newbie@gmail.com',
        username: 'Newbie',
        // New accounts get the bundled default picture.
        thumbnail: DEFAULT_THUMBNAIL_URL,
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

      const res = await request(server)
        .get('/user')
        .set(bearer(token))
        .expect(200);

      expect(res.body.totalPostCount).toBe(2);
    });
  });

  describe('GET /user/:userEmail', () => {
    // NOTE: The Flutter app sends the email in the `userEmail` QUERY parameter
    // (and the literal text "{userEmail}" in the path). The server reads the
    // query parameter first and falls back to the path, so both the app and
    // normal REST clients work.

    it("returns another user's profile with the isFollowing flag", async () => {
      const token = await signIn(app, 'viewer@gmail.com');
      await signIn(app, 'target@gmail.com', 'Target');

      const res = await request(server)
        .get('/user/target@gmail.com')
        .query({ userEmail: 'target@gmail.com' })
        .set(bearer(token))
        .expect(200);

      // `toMatchObject` only checks the listed fields and ignores the rest.
      expect(res.body).toMatchObject({
        email: 'target@gmail.com',
        username: 'Target',
        isFollowing: false,
      });
    });

    it("does not reveal another user's bookmarks", async () => {
      // Bookmarks are private (like on Instagram). The response used to include
      // the other user's full list of bookmarked post ids.
      const token = await signIn(app, 'viewer@gmail.com');
      const targetToken = await signIn(app, 'collector@gmail.com');
      const post = await createPost(app, targetToken);
      await request(server)
        .post('/user/post/bookmark')
        .set(bearer(targetToken))
        .send({ postId: post.id })
        .expect(201);

      const res = await request(server)
        .get('/user/collector@gmail.com')
        .query({ userEmail: 'collector@gmail.com' })
        .set(bearer(token))
        .expect(200);

      expect(res.body).not.toHaveProperty('bookMarks');
    });

    it('also accepts the email in the path (without the query parameter)', async () => {
      const token = await signIn(app, 'viewer@gmail.com');
      await signIn(app, 'target@gmail.com', 'Target');

      const res = await request(server)
        .get('/user/target@gmail.com')
        .set(bearer(token))
        .expect(200);

      expect(res.body.email).toBe('target@gmail.com');
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

      await request(server)
        .patch('/user/statusMessage')
        .set(bearer(token))
        .send({ statusMessage: 'Hello!' })
        .expect(200);

      // Read the profile back to prove the change was actually saved.
      const res = await request(server)
        .get('/user')
        .set(bearer(token))
        .expect(200);
      expect(res.body.statusMessage).toBe('Hello!');
    });

    it('accepts an empty string to clear the status message', async () => {
      const token = await signIn(app, 'status@gmail.com');

      await request(server)
        .patch('/user/statusMessage')
        .set(bearer(token))
        .send({ statusMessage: '' })
        .expect(200);
    });

    it('rejects a request without statusMessage', async () => {
      // Previously answered 200 and silently changed nothing.
      const token = await signIn(app, 'status@gmail.com');

      await request(server)
        .patch('/user/statusMessage')
        .set(bearer(token))
        .send({})
        .expect(400);
    });
  });

  describe('POST /user/post/bookmark', () => {
    it('toggles a bookmark on and off', async () => {
      const token = await signIn(app, 'reader@gmail.com');
      const post = await createPost(app, token);

      // 1st call: the post is not bookmarked yet, so it gets bookmarked.
      await request(server)
        .post('/user/post/bookmark')
        .set(bearer(token))
        .send({ postId: post.id })
        .expect(201);
      let res = await request(server)
        .get('/user')
        .set(bearer(token))
        .expect(200);
      expect(res.body.bookMarks).toEqual([post.id]);

      // 2nd call with the same post: the bookmark is removed again.
      await request(server)
        .post('/user/post/bookmark')
        .set(bearer(token))
        .send({ postId: post.id })
        .expect(201);
      res = await request(server).get('/user').set(bearer(token)).expect(200);
      expect(res.body.bookMarks).toEqual([]);
    });

    it('returns 404 for an unknown post and does NOT change the bookmarks', async () => {
      // Previously the user's own list was saved FIRST and the post lookup failed
      // afterwards: the response was 404, but the unknown id stayed bookmarked.
      const token = await signIn(app, 'careful@gmail.com');

      await request(server)
        .post('/user/post/bookmark')
        .set(bearer(token))
        .send({ postId: 999999 })
        .expect(404);

      const res = await request(server)
        .get('/user')
        .set(bearer(token))
        .expect(200);
      expect(res.body.bookMarks).toEqual([]);
    });

    it("returns 404 for someone else's PRIVATE post", async () => {
      const authorToken = await signIn(app, 'secretive@gmail.com');
      const post = await createPost(app, authorToken);
      await request(server)
        .patch(`/post/${post.id}/status`)
        .set(bearer(authorToken))
        .expect(200);
      const token = await signIn(app, 'curious@gmail.com');

      await request(server)
        .post('/user/post/bookmark')
        .set(bearer(token))
        .send({ postId: post.id })
        .expect(404);
    });
  });

  describe('thumbnail', () => {
    it('uploads a new thumbnail and resets it to the default', async () => {
      const token = await signIn(app, 'selfie@gmail.com');

      // The field name must be "file" (single-file upload).
      const uploaded = await request(server)
        .patch('/user/thumbnail')
        .set(bearer(token))
        .attach('file', TEST_IMAGE)
        .expect(200);
      // The server renames uploads to "<timestamp>.<extension>".
      expect(uploaded.body.updatedThumbnail).toMatch(/\/images\/\d+\.jpeg$/);

      const reset = await request(server)
        .delete('/user/thumbnail')
        .set(bearer(token))
        .expect(200);
      expect(reset.body.updatedThumbnail).toBe(DEFAULT_THUMBNAIL_URL);
    });

    it('rejects an upload without a file', async () => {
      // Previously `file.filename` was read from `undefined` → 500.
      const token = await signIn(app, 'selfie@gmail.com');

      await request(server)
        .patch('/user/thumbnail')
        .set(bearer(token))
        .expect(400);
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
      expect(res.body.userList.map((user) => user.email).sort()).toEqual([
        'alice@gmail.com',
        'alicia@gmail.com',
      ]);
    });

    it('returns results in a stable order (by username)', async () => {
      // Without ORDER BY, the database may return rows in any order, so pages
      // could overlap or skip users while scrolling.
      const token = await signIn(app, 'sorter@gmail.com');
      await signIn(app, 'ordc@gmail.com', 'OrdC');
      await signIn(app, 'orda@gmail.com', 'OrdA');
      await signIn(app, 'ordb@gmail.com', 'OrdB');

      const res = await request(server)
        .get('/user/search/users')
        .query({ keyword: 'Ord', page: 1, limit: 10 })
        .set(bearer(token))
        .expect(200);

      expect(res.body.userList.map((user) => user.username)).toEqual([
        'OrdA',
        'OrdB',
        'OrdC',
      ]);
    });

    it('treats a missing keyword like an empty one (matches everyone else)', async () => {
      // Previously the text "undefined" was searched for, so nothing matched.
      const token = await signIn(app, 'searcher@gmail.com', 'Searcher');

      const withEmpty = await request(server)
        .get('/user/search/users')
        .query({ keyword: '', page: 1, limit: 1 })
        .set(bearer(token))
        .expect(200);
      const withoutKeyword = await request(server)
        .get('/user/search/users')
        .query({ page: 1, limit: 1 })
        .set(bearer(token))
        .expect(200);

      expect(withEmpty.body.total).toBeGreaterThan(0);
      expect(withoutKeyword.body.total).toBe(withEmpty.body.total);
    });

    it('matches "%" and "_" literally instead of as SQL wildcards', async () => {
      // In SQL LIKE, "%" means "anything", so the keyword "%" used to match
      // every user. No username contains a literal "%".
      const token = await signIn(app, 'searcher@gmail.com', 'Searcher');

      const res = await request(server)
        .get('/user/search/users')
        .query({ keyword: '%', page: 1, limit: 10 })
        .set(bearer(token))
        .expect(200);

      expect(res.body.total).toBe(0);
    });
  });
});
