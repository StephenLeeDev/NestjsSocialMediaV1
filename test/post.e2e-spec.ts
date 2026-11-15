/**
 * ============================================================================
 *  Post e2e tests
 * ============================================================================
 *
 * Covers the `/post` endpoints behind the Flutter app's feed and post screens:
 *   - POST   /post                  : create a post with images (multipart upload)
 *   - GET    /post                  : the global feed (paginated, newest first)
 *   - GET    /post/my               : the signed-in user's posts
 *   - GET    /post/user             : the posts of a given user
 *   - GET    /post/:id              : a single post (incl. comment count)
 *   - POST   /post/:postId/like     : like / unlike (toggle)
 *   - PATCH  /post/description      : edit the description (author only)
 *   - DELETE /post/:id              : delete a post (author only)
 *
 * Two users are used throughout:
 *   - "author" writes most of the posts
 *   - "other"  is a second user, used to check permissions (e.g. that they
 *              cannot edit or delete the author's posts)
 */
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  bearer,
  createComment,
  createPost,
  createTestApp,
  resetDatabase,
  signIn,
  TEST_IMAGE,
} from './utils/test-app';

describe('Post (e2e)', () => {
  let app: NestExpressApplication;
  // The in-memory HTTP server that supertest sends requests to.
  let server: ReturnType<NestExpressApplication['getHttpServer']>;
  // Access tokens of the two users described in the header comment.
  let token: string;
  let otherToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    await resetDatabase(app);
    token = await signIn(app, 'author@gmail.com', 'Author');
    otherToken = await signIn(app, 'other@gmail.com', 'Other');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /post', () => {
    it('creates a post with uploaded images', async () => {
      // `files` is attached twice: the server accepts up to 4 images per post.
      const res = await request(server)
        .post('/post')
        .set(bearer(token))
        .field('description', 'Two pictures')
        .attach('files', TEST_IMAGE)
        .attach('files', TEST_IMAGE)
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(Number),
        description: 'Two pictures',
        status: 'PUBLIC',
        // A brand-new post has no likes, bookmarks or comments yet.
        isLiked: false,
        isBookmarked: false,
        commentCount: 0,
        user: { email: 'author@gmail.com', username: 'Author' },
      });
      expect(res.body.imageUrls).toHaveLength(2);
    });
  });

  describe('post lists', () => {
    // List tests need exact totals, so this block starts from an EMPTY database
    // again (posts created by earlier tests would change the counts) and then
    // creates exactly three posts: two by "author", one by "other".
    beforeAll(async () => {
      await resetDatabase(app);
      // Users were wiped too, so sign them in again (this recreates them).
      token = await signIn(app, 'author@gmail.com', 'Author');
      otherToken = await signIn(app, 'other@gmail.com', 'Other');
      // Created in this order, so "third" is the newest post.
      await createPost(app, token, 'first');
      await createPost(app, token, 'second');
      await createPost(app, otherToken, 'third');
    });

    it('GET /post paginates all public posts, newest first', async () => {
      const res = await request(server)
        .get('/post')
        .query({ page: 1, limit: 2 })
        .set(bearer(token))
        .expect(200);

      // `total` counts every post, while `posts` only holds this page (2 items).
      expect(res.body.total).toBe(3);
      expect(res.body.posts.map((post) => post.description)).toEqual([
        'third',
        'second',
      ]);
    });

    it("GET /post/my returns only the current user's posts", async () => {
      const res = await request(server)
        .get('/post/my')
        .query({ page: 1, limit: 10 })
        .set(bearer(token))
        .expect(200);

      expect(res.body.total).toBe(2);
      expect(
        res.body.posts.every((post) => post.user.email === 'author@gmail.com'),
      ).toBe(true);
    });

    it('GET /post/user returns the posts of the given user', async () => {
      const res = await request(server)
        .get('/post/user')
        .query({ email: 'other@gmail.com', page: 1, limit: 10 })
        .set(bearer(token))
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.posts[0].description).toBe('third');
    });
  });

  describe('GET /post/:id', () => {
    it('returns the post with its comment count (comments + replies)', async () => {
      const post = await createPost(app, token);
      // One top-level comment and one reply to it.
      const comment = await createComment(app, otherToken, post.id);
      await createComment(app, token, post.id, 'reply', {
        id: comment.id,
        authorEmail: 'other@gmail.com',
      });

      const res = await request(server)
        .get(`/post/${post.id}`)
        .set(bearer(token))
        .expect(200);

      // commentCount includes replies: 1 comment + 1 reply = 2.
      expect(res.body).toMatchObject({ id: post.id, commentCount: 2 });
    });

    it('returns 404 for an unknown post', async () => {
      await request(server).get('/post/999999').set(bearer(token)).expect(404);
    });
  });

  describe('POST /post/:postId/like', () => {
    // NOTE: The post id appears in the URL, but the server actually reads it from
    // the request BODY (`{ postId }`). The Flutter app sends it in the body as
    // well, so the test does the same. Cleaning this up is a later API change.

    it('toggles a like and reflects it in the feed', async () => {
      const post = await createPost(app, token);

      // 1st call: "other" likes the post.
      let res = await request(server)
        .post(`/post/${post.id}/like`)
        .set(bearer(otherToken))
        .send({ postId: post.id })
        .expect(201);
      expect(res.body).toEqual({ likeCount: 1 });

      // From "other"'s point of view the post is now liked.
      const feed = await request(server)
        .get(`/post/${post.id}`)
        .set(bearer(otherToken))
        .expect(200);
      expect(feed.body).toMatchObject({ likeCount: 1, isLiked: true });

      // 2nd call: the same user likes again, which removes the like.
      res = await request(server)
        .post(`/post/${post.id}/like`)
        .set(bearer(otherToken))
        .send({ postId: post.id })
        .expect(201);
      expect(res.body).toEqual({ likeCount: 0 });
    });
  });

  describe('PATCH /post/description', () => {
    it("updates the author's own post", async () => {
      const post = await createPost(app, token, 'before');

      const res = await request(server)
        .patch('/post/description')
        .set(bearer(token))
        .send({ postId: post.id, description: 'after' })
        .expect(200);

      expect(res.body.description).toBe('after');
    });

    it("rejects updating someone else's post", async () => {
      const post = await createPost(app, token, 'mine');

      // The server answers 401 Unauthorized here. (403 Forbidden would be the more
      // precise status for "you are signed in but not allowed"; this test records
      // the current behaviour so a future change is a conscious decision.)
      await request(server)
        .patch('/post/description')
        .set(bearer(otherToken))
        .send({ postId: post.id, description: 'hacked' })
        .expect(401);
    });
  });

  describe('DELETE /post/:id', () => {
    it("deletes the author's own post", async () => {
      const post = await createPost(app, token);

      await request(server)
        .delete(`/post/${post.id}`)
        .set(bearer(token))
        .expect(200);
      // It is really gone.
      await request(server)
        .get(`/post/${post.id}`)
        .set(bearer(token))
        .expect(404);
    });

    it("does not delete someone else's post", async () => {
      const post = await createPost(app, token);

      // The delete query only matches posts owned by the caller, so for anyone
      // else the post "does not exist" (404) and nothing is deleted.
      await request(server)
        .delete(`/post/${post.id}`)
        .set(bearer(otherToken))
        .expect(404);
      await request(server)
        .get(`/post/${post.id}`)
        .set(bearer(token))
        .expect(200);
    });

    it('deletes a post that has comments, together with its comments', async () => {
      // Regression test: this used to fail with 500 because the comments still
      // referenced the post (foreign key). Comments are now deleted along with
      // the post via `onDelete: 'CASCADE'` in `CommentEntity`.
      const post = await createPost(app, token);
      const comment = await createComment(app, otherToken, post.id);
      await createComment(app, token, post.id, 'reply', {
        id: comment.id,
        authorEmail: 'other@gmail.com',
      });

      await request(server)
        .delete(`/post/${post.id}`)
        .set(bearer(token))
        .expect(200);

      await request(server)
        .get(`/post/${post.id}`)
        .set(bearer(token))
        .expect(404);
    });
  });
});
