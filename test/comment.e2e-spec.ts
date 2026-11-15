/**
 * ============================================================================
 *  Comment e2e tests
 * ============================================================================
 *
 * Covers the `/comment` endpoints behind the Flutter app's comment and reply screens:
 *   - POST   /comment        : create a comment, or a reply when parentCommentId is set
 *   - GET    /comment        : top-level comments of a post (+ number of replies each)
 *   - GET    /comment/reply  : replies of one comment
 *   - PATCH  /comment        : edit a comment (author only)
 *   - DELETE /comment/:id    : delete a comment (author only)
 *   - POST   /comment/test/dummy : development helper that generates comments
 *
 * Terminology used by the server:
 *   - COMMENT : written directly on a post
 *   - REPLY   : written on a comment (it has `parentCommentId`)
 * Both are stored in the same table and both count towards a post's commentCount.
 * Replies are ONE level deep: a reply always belongs to a top-level comment
 * (the Flutter app's reply screen works this way).
 *
 * Users: "commenter" (writes most comments) and "replier" (a second user,
 * used for replies and permission checks).
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
} from './utils/test-app';

describe('Comment (e2e)', () => {
  let app: NestExpressApplication;
  // The in-memory HTTP server that supertest sends requests to.
  let server: ReturnType<NestExpressApplication['getHttpServer']>;
  let token: string; // "commenter"
  let otherToken: string; // "replier"
  // A shared post for tests that don't care which post they comment on.
  let postId: number;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    await resetDatabase(app);
    token = await signIn(app, 'commenter@gmail.com', 'Commenter');
    otherToken = await signIn(app, 'replier@gmail.com', 'Replier');
    postId = (await createPost(app, token)).id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /comment', () => {
    it('creates a top-level comment', async () => {
      const comment = await createComment(app, token, postId, 'Nice!');

      expect(comment).toMatchObject({
        id: expect.any(Number),
        content: 'Nice!',
        type: 'COMMENT',
        postId,
        // A top-level comment has no parent.
        parentCommentId: null,
        user: { email: 'commenter@gmail.com', username: 'Commenter' },
      });
    });

    it('creates a reply when parentCommentId is given', async () => {
      const parent = await createComment(app, token, postId);

      const reply = await createComment(app, otherToken, postId, 'Thanks', {
        id: parent.id,
        authorEmail: 'commenter@gmail.com',
      });

      // The server decides the type from whether a parent was given.
      expect(reply).toMatchObject({
        type: 'REPLY',
        parentCommentId: parent.id,
        parentCommentAuthor: 'commenter@gmail.com',
      });
    });

    it('returns 404 for an unknown post', async () => {
      await request(server)
        .post('/comment')
        .set(bearer(token))
        .send({ content: 'x', postId: 999999 })
        .expect(404);
    });

    it('rejects a postId that is not a whole number', async () => {
      // Previously "abc" reached the database query and caused a 500.
      await request(server)
        .post('/comment')
        .set(bearer(token))
        .send({ content: 'x', postId: 'abc' })
        .expect(400);
    });

    it('accepts parentCommentId: null for a top-level comment', async () => {
      // The Flutter app sends an explicit null instead of leaving the field out.
      const res = await request(server)
        .post('/comment')
        .set(bearer(token))
        .send({
          content: 'x',
          postId,
          parentCommentId: null,
          parentCommentAuthor: null,
        })
        .expect(201);

      expect(res.body.type).toBe('COMMENT');
    });

    it('returns 404 when the parent comment does not exist', async () => {
      // Previously the database rejected the unknown parent id → 500.
      await request(server)
        .post('/comment')
        .set(bearer(token))
        .send({ content: 'x', postId, parentCommentId: 999999 })
        .expect(404);
    });

    it('rejects a reply whose parent comment belongs to another post', async () => {
      const otherPostId = (await createPost(app, token)).id;
      const parentOnOtherPost = await createComment(app, token, otherPostId);

      await request(server)
        .post('/comment')
        .set(bearer(token))
        .send({ content: 'x', postId, parentCommentId: parentOnOtherPost.id })
        .expect(400);
    });

    it('rejects a reply to a reply (replies are one level deep)', async () => {
      const parent = await createComment(app, token, postId);
      const reply = await createComment(app, otherToken, postId, 'reply', {
        id: parent.id,
        authorEmail: 'commenter@gmail.com',
      });

      await request(server)
        .post('/comment')
        .set(bearer(token))
        .send({ content: 'x', postId, parentCommentId: reply.id })
        .expect(400);
    });

    it('takes parentCommentAuthor from the parent comment, not from the request', async () => {
      // The client could previously write ANY email into parentCommentAuthor.
      // The server now looks up who really wrote the parent comment.
      const parent = await createComment(app, token, postId);

      const res = await request(server)
        .post('/comment')
        .set(bearer(otherToken))
        .send({
          content: 'x',
          postId,
          parentCommentId: parent.id,
          parentCommentAuthor: 'someone-else@gmail.com',
        })
        .expect(201);

      expect(res.body.parentCommentAuthor).toBe('commenter@gmail.com');
    });
  });

  describe('comment lists', () => {
    // A dedicated post with a known structure, so the counts below are exact:
    //
    //   post
    //   ├── "parent"  (comment)
    //   │    ├── "reply 1"
    //   │    └── "reply 2"
    //   └── "lonely"  (comment, no replies)
    let listPostId: number;
    let parentId: number;

    beforeAll(async () => {
      listPostId = (await createPost(app, token)).id;
      parentId = (await createComment(app, token, listPostId, 'parent')).id;
      await createComment(app, token, listPostId, 'lonely');
      await createComment(app, otherToken, listPostId, 'reply 1', {
        id: parentId,
        authorEmail: 'commenter@gmail.com',
      });
      await createComment(app, otherToken, listPostId, 'reply 2', {
        id: parentId,
        authorEmail: 'commenter@gmail.com',
      });
    });

    it('GET /comment lists only top-level comments with their reply counts', async () => {
      const res = await request(server)
        .get('/comment')
        .query({ postId: listPostId, page: 1, limit: 10 })
        .set(bearer(token))
        .expect(200);

      // Replies are not listed here, only the 2 top-level comments.
      expect(res.body.total).toBe(2);
      // Turn the list into { content: childrenCount } so the check does not
      // depend on the order in which the comments come back.
      const counts = Object.fromEntries(
        res.body.comments.map((comment) => [
          comment.content,
          comment.childrenCount,
        ]),
      );
      expect(counts).toEqual({ parent: 2, lonely: 0 });
    });

    it('GET /comment/reply lists the replies of a comment', async () => {
      const res = await request(server)
        .get('/comment/reply')
        .query({
          parentCommentId: parentId,
          postId: listPostId,
          page: 1,
          limit: 10,
        })
        .set(bearer(token))
        .expect(200);

      expect(res.body.total).toBe(2);
      expect(
        res.body.comments.every((comment) => comment.type === 'REPLY'),
      ).toBe(true);
      // Every comment object has the same shape: replies report 0 replies
      // instead of leaving the field out.
      expect(
        res.body.comments.every((comment) => comment.childrenCount === 0),
      ).toBe(true);
    });

    it("counts comments and replies in the post's commentCount", async () => {
      const res = await request(server)
        .get(`/post/${listPostId}`)
        .set(bearer(token))
        .expect(200);

      // 2 comments + 2 replies.
      expect(res.body.commentCount).toBe(4);
    });
  });

  describe('PATCH /comment', () => {
    it("updates the author's own comment", async () => {
      const comment = await createComment(app, token, postId, 'typo');

      const res = await request(server)
        .patch('/comment')
        .set(bearer(token))
        .send({ id: comment.id, content: 'fixed' })
        .expect(200);

      expect(res.body).toMatchObject({ id: comment.id, content: 'fixed' });
    });

    it("rejects updating someone else's comment", async () => {
      const comment = await createComment(app, token, postId);

      // Same as posts: the server answers 401 (403 would be more precise).
      await request(server)
        .patch('/comment')
        .set(bearer(otherToken))
        .send({ id: comment.id, content: 'hacked' })
        .expect(401);
    });

    it('returns 404 for an unknown comment', async () => {
      // Previously this answered 200 with an EMPTY body.
      await request(server)
        .patch('/comment')
        .set(bearer(token))
        .send({ id: 999999, content: 'x' })
        .expect(404);
    });

    it('rejects an update without id', async () => {
      // Previously `findOne({ where: { id: undefined } })` → 500.
      await request(server)
        .patch('/comment')
        .set(bearer(token))
        .send({ content: 'x' })
        .expect(400);
    });
  });

  describe('comments on PRIVATE posts', () => {
    // A PRIVATE post is invisible to everyone but its author (see the post
    // tests). Its comments must follow the same rule, otherwise the "hidden"
    // post could still be read and commented on through these endpoints.
    let privatePostId: number;

    beforeAll(async () => {
      privatePostId = (await createPost(app, token)).id;
      await request(server)
        .patch(`/post/${privatePostId}/status`)
        .set(bearer(token))
        .expect(200);
    });

    it('lets the author comment and read the comments', async () => {
      await createComment(app, token, privatePostId, 'note to self');

      const res = await request(server)
        .get('/comment')
        .query({ postId: privatePostId, page: 1, limit: 10 })
        .set(bearer(token))
        .expect(200);
      expect(res.body.total).toBe(1);
    });

    it('hides them from other users (404)', async () => {
      await request(server)
        .post('/comment')
        .set(bearer(otherToken))
        .send({ content: 'x', postId: privatePostId })
        .expect(404);
      await request(server)
        .get('/comment')
        .query({ postId: privatePostId, page: 1, limit: 10 })
        .set(bearer(otherToken))
        .expect(404);
    });
  });

  describe('DELETE /comment/:id', () => {
    it("deletes the author's own comment", async () => {
      const comment = await createComment(app, token, postId);

      await request(server)
        .delete(`/comment/${comment.id}`)
        .set(bearer(token))
        .expect(200);
    });

    it("does not delete someone else's comment", async () => {
      const comment = await createComment(app, token, postId);

      // The delete only matches the caller's own comments, so for anyone else
      // the comment "does not exist" (404).
      await request(server)
        .delete(`/comment/${comment.id}`)
        .set(bearer(otherToken))
        .expect(404);
    });

    it('deletes a comment that has replies, together with its replies', async () => {
      // Regression test: this used to fail with 500 because the replies still
      // referenced the parent comment (foreign key). Replies are now deleted
      // along with their parent via `onDelete: 'CASCADE'` in `CommentEntity`.
      // A fresh post is used so its commentCount starts at exactly 0.
      const deletePostId = (await createPost(app, token)).id;
      const parent = await createComment(app, token, deletePostId);
      await createComment(app, otherToken, deletePostId, 'reply', {
        id: parent.id,
        authorEmail: 'commenter@gmail.com',
      });

      await request(server)
        .delete(`/comment/${parent.id}`)
        .set(bearer(token))
        .expect(200);

      // Both the comment AND its reply are gone.
      const res = await request(server)
        .get(`/post/${deletePostId}`)
        .set(bearer(token))
        .expect(200);
      expect(res.body.commentCount).toBe(0);
    });
  });

  describe('POST /comment/test/dummy (development helper)', () => {
    it('creates 10 comments that exist as soon as the request returns', async () => {
      // Previously the comments were saved in the background with timers, so
      // they did not exist yet when the response arrived.
      const dummyPostId = (await createPost(app, token)).id;

      await request(server)
        .post('/comment/test/dummy')
        .set(bearer(token))
        .send({ postId: dummyPostId })
        .expect(201);

      const res = await request(server)
        .get('/comment')
        .query({ postId: dummyPostId, page: 1, limit: 1 })
        .set(bearer(token))
        .expect(200);
      expect(res.body.total).toBe(10);
    });

    it('returns 404 for an unknown post', async () => {
      // Previously the request answered 201 and the background saves crashed.
      await request(server)
        .post('/comment/test/dummy')
        .set(bearer(token))
        .send({ postId: 999999 })
        .expect(404);
    });
  });
});
