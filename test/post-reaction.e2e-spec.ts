/**
 * ============================================================================
 *  Likes and bookmarks e2e tests
 * ============================================================================
 *
 * Covers the NEW endpoints:
 *   - PUT    /post/:id/like       : like a post        (idempotent)
 *   - DELETE /post/:id/like       : remove your like   (idempotent)
 *   - PUT    /post/:id/bookmark   : bookmark a post    (idempotent)
 *   - DELETE /post/:id/bookmark   : remove a bookmark  (idempotent)
 *   - GET    /user/bookmarks      : your bookmarked posts, newest bookmark first
 *
 * and how the OLD toggle endpoints behave after the storage change:
 *   - POST   /post/:postId/like   (toggle, kept for the current Flutter app)
 *   - POST   /user/post/bookmark  (toggle, kept for the current Flutter app)
 *
 * "Idempotent" means: sending the same request twice has the same result as
 * sending it once. A double tap or a network retry can therefore never undo
 * the user's action, which a TOGGLE endpoint cannot guarantee.
 *
 * The concurrency tests in this file are the reason for the change: likes
 * and bookmarks used to be stored as arrays that were read, modified and
 * written back as a whole, so simultaneous requests overwrote each other.
 */
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  bearer,
  createPost,
  createTestApp,
  resetDatabase,
  signIn,
} from './utils/test-app';

describe('Likes and bookmarks (e2e)', () => {
  let app: NestExpressApplication;
  // The in-memory HTTP server that supertest sends requests to.
  let server: ReturnType<NestExpressApplication['getHttpServer']>;
  // "author" writes the posts, "fan" likes and bookmarks them.
  let authorToken: string;
  let fanToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    await resetDatabase(app);
    authorToken = await signIn(app, 'author@gmail.com', 'Author');
    fanToken = await signIn(app, 'fan@gmail.com', 'Fan');
  });

  afterAll(async () => {
    await app.close();
  });

  /** Creates a new post by "author" and returns its id. */
  const newPostId = async (): Promise<number> =>
    (await createPost(app, authorToken)).id;

  /** GET /post/:id as the owner of `token` (for likeCount / isLiked / isBookmarked). */
  const viewPost = async (postId: number, token: string) =>
    (
      await request(server)
        .get(`/post/${postId}`)
        .set(bearer(token))
        .expect(200)
    ).body;

  /** Makes the author's post PRIVATE (only the author can see it then). */
  const makePrivate = (postId: number) =>
    request(server)
      .patch(`/post/${postId}/status`)
      .set(bearer(authorToken))
      .expect(200);

  /** Signs in `count` new users at once and returns their tokens. */
  const signInMany = (count: number, prefix: string) =>
    Promise.all(
      Array.from({ length: count }, (_, i) =>
        signIn(app, `${prefix}${i}@gmail.com`),
      ),
    );

  // ==========================================================================
  //  Likes
  // ==========================================================================

  describe('PUT / DELETE /post/:id/like', () => {
    it('likes a post and returns the new state', async () => {
      const postId = await newPostId();

      const res = await request(server)
        .put(`/post/${postId}/like`)
        .set(bearer(fanToken))
        .expect(200);

      expect(res.body).toEqual({ postId, isLiked: true, likeCount: 1 });
      expect(await viewPost(postId, fanToken)).toMatchObject({
        likeCount: 1,
        isLiked: true,
      });
      // The author sees the count, but has not liked the post themself.
      expect(await viewPost(postId, authorToken)).toMatchObject({
        likeCount: 1,
        isLiked: false,
      });
    });

    it('is idempotent: liking twice still counts one like', async () => {
      const postId = await newPostId();

      for (let i = 0; i < 2; i++) {
        const res = await request(server)
          .put(`/post/${postId}/like`)
          .set(bearer(fanToken))
          .expect(200);
        expect(res.body).toEqual({ postId, isLiked: true, likeCount: 1 });
      }
    });

    it('removes a like, and removing it again changes nothing', async () => {
      const postId = await newPostId();
      await request(server)
        .put(`/post/${postId}/like`)
        .set(bearer(fanToken))
        .expect(200);

      for (let i = 0; i < 2; i++) {
        const res = await request(server)
          .delete(`/post/${postId}/like`)
          .set(bearer(fanToken))
          .expect(200);
        expect(res.body).toEqual({ postId, isLiked: false, likeCount: 0 });
      }
    });

    it('answers 404 for an unknown post', async () => {
      await request(server)
        .put('/post/999999/like')
        .set(bearer(fanToken))
        .expect(404);
    });

    it("answers 404 for another user's PRIVATE post", async () => {
      const postId = await newPostId();
      await makePrivate(postId);

      await request(server)
        .put(`/post/${postId}/like`)
        .set(bearer(fanToken))
        .expect(404);
    });

    it('counts every like when 20 users like at the same moment', async () => {
      const postId = await newPostId();
      const tokens = await signInMany(20, 'liker');

      await Promise.all(
        tokens.map((token) =>
          request(server)
            .put(`/post/${postId}/like`)
            .set(bearer(token))
            .expect(200),
        ),
      );

      expect((await viewPost(postId, authorToken)).likeCount).toBe(20);
    });
  });

  describe('POST /post/:postId/like (old toggle, kept for the current app)', () => {
    it('still toggles and answers { likeCount }', async () => {
      const postId = await newPostId();
      const toggle = () =>
        request(server)
          .post(`/post/${postId}/like`)
          .set(bearer(fanToken))
          .send({ postId })
          .expect(201);

      expect((await toggle()).body).toEqual({ likeCount: 1 });
      expect((await toggle()).body).toEqual({ likeCount: 0 });
    });

    it('counts every like when 20 users toggle at the same moment', async () => {
      // Before this change only 2 to 4 of these 20 likes survived: every
      // request read the post's `likes` array, added its email and wrote the
      // whole array back, overwriting what the others had just written.
      const postId = await newPostId();
      const tokens = await signInMany(20, 'toggler');

      await Promise.all(
        tokens.map((token) =>
          request(server)
            .post(`/post/${postId}/like`)
            .set(bearer(token))
            .send({ postId })
            .expect(201),
        ),
      );

      expect((await viewPost(postId, authorToken)).likeCount).toBe(20);
    });

    it("answers 404 for another user's PRIVATE post", async () => {
      // The old code did not check visibility here, so anyone could like a
      // hidden post by guessing its id.
      const postId = await newPostId();
      await makePrivate(postId);

      await request(server)
        .post(`/post/${postId}/like`)
        .set(bearer(fanToken))
        .send({ postId })
        .expect(404);
    });
  });

  // ==========================================================================
  //  Bookmarks
  // ==========================================================================

  describe('PUT / DELETE /post/:id/bookmark', () => {
    it('bookmarks a post (idempotent) and returns the new state', async () => {
      const postId = await newPostId();

      for (let i = 0; i < 2; i++) {
        const res = await request(server)
          .put(`/post/${postId}/bookmark`)
          .set(bearer(fanToken))
          .expect(200);
        expect(res.body).toEqual({ postId, isBookmarked: true });
      }
      expect((await viewPost(postId, fanToken)).isBookmarked).toBe(true);
      // Bookmarks are personal: the author does not see the fan's bookmark.
      expect((await viewPost(postId, authorToken)).isBookmarked).toBe(false);
    });

    it('removes a bookmark (idempotent)', async () => {
      const postId = await newPostId();
      await request(server)
        .put(`/post/${postId}/bookmark`)
        .set(bearer(fanToken))
        .expect(200);

      for (let i = 0; i < 2; i++) {
        const res = await request(server)
          .delete(`/post/${postId}/bookmark`)
          .set(bearer(fanToken))
          .expect(200);
        expect(res.body).toEqual({ postId, isBookmarked: false });
      }
      expect((await viewPost(postId, fanToken)).isBookmarked).toBe(false);
    });

    it("answers 404 for an unknown post and for another user's PRIVATE post", async () => {
      await request(server)
        .put('/post/999999/bookmark')
        .set(bearer(fanToken))
        .expect(404);

      const postId = await newPostId();
      await makePrivate(postId);
      await request(server)
        .put(`/post/${postId}/bookmark`)
        .set(bearer(fanToken))
        .expect(404);
    });
  });

  describe('POST /user/post/bookmark (old toggle, kept for the current app)', () => {
    it('keeps every bookmark when 20 users toggle at the same moment', async () => {
      // Before this change each bookmark was written to TWO arrays (the
      // user's and the post's). Under concurrency the post's array lost most
      // entries, so 16 of these 20 users saw the post as NOT bookmarked.
      const postId = await newPostId();
      const tokens = await signInMany(20, 'saver');

      await Promise.all(
        tokens.map((token) =>
          request(server)
            .post('/user/post/bookmark')
            .set(bearer(token))
            .send({ postId })
            .expect(201),
        ),
      );

      for (const token of tokens) {
        expect((await viewPost(postId, token)).isBookmarked).toBe(true);
      }
    });
  });

  describe('GET /user/bookmarks', () => {
    // A dedicated user, so bookmarks made by other tests do not interfere.
    let readerToken: string;

    beforeAll(async () => {
      readerToken = await signIn(app, 'reader@gmail.com', 'Reader');
    });

    /** GET /user/bookmarks as the reader; returns the ids in response order. */
    const bookmarkedIds = async (page = 1, limit = 10) => {
      const res = await request(server)
        .get('/user/bookmarks')
        .query({ page, limit })
        .set(bearer(readerToken))
        .expect(200);
      return {
        ids: res.body.posts.map((post: { id: number }) => post.id),
        total: res.body.total,
        posts: res.body.posts,
      };
    };

    it('lists bookmarked posts, the most recently bookmarked first, with paging', async () => {
      const first = await newPostId();
      const second = await newPostId();
      const third = await newPostId();

      // Bookmarked in the order first → third → second.
      for (const postId of [first, third, second]) {
        await request(server)
          .put(`/post/${postId}/bookmark`)
          .set(bearer(readerToken))
          .expect(200);
      }

      const all = await bookmarkedIds();
      expect(all.ids).toEqual([second, third, first]);
      expect(all.total).toBe(3);
      // Each entry is a normal post as seen by the reader.
      expect(all.posts[0]).toMatchObject({
        id: second,
        isBookmarked: true,
        user: { email: 'author@gmail.com' },
      });

      // Page 2 with 2 posts per page holds only the oldest bookmark.
      expect(await bookmarkedIds(2, 2)).toMatchObject({
        ids: [first],
        total: 3,
      });
    });

    it('hides posts the author made PRIVATE, and drops deleted posts', async () => {
      const hidden = await newPostId();
      const deleted = await newPostId();
      for (const postId of [hidden, deleted]) {
        await request(server)
          .put(`/post/${postId}/bookmark`)
          .set(bearer(readerToken))
          .expect(200);
      }

      await makePrivate(hidden);
      await request(server)
        .delete(`/post/${deleted}`)
        .set(bearer(authorToken))
        .expect(200);

      const { ids } = await bookmarkedIds();
      expect(ids).not.toContain(hidden);
      expect(ids).not.toContain(deleted);

      // The old profile field `bookMarks` follows the same rules. (It used to
      // keep the ids of deleted posts forever.)
      const profile = await request(server)
        .get('/user')
        .set(bearer(readerToken))
        .expect(200);
      expect(profile.body.bookMarks).not.toContain(hidden);
      expect(profile.body.bookMarks).not.toContain(deleted);
    });

    it('rejects a request without paging parameters', async () => {
      await request(server)
        .get('/user/bookmarks')
        .set(bearer(readerToken))
        .expect(400);
    });
  });
});
