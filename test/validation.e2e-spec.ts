/**
 * ============================================================================
 *  Request validation e2e tests
 * ============================================================================
 *
 * Request bodies are described by DTO classes, and class-validator decorators
 * on their fields (e.g. `@IsNotEmpty()`) declare the rules. Those rules only
 * run when a `ValidationPipe` is active. These tests check that invalid input
 * is rejected with 400 Bad Request BEFORE it reaches the service layer.
 *
 * Why it matters:
 *   Without validation, a missing field flows into the database query. TypeORM
 *   then fails on the `undefined` value and the client gets a confusing
 *   500 Internal Server Error instead of a clear 400 explaining what is wrong.
 *
 * Scope: the DTOs that already declare validation rules today. DTOs without
 * rules get them in the per-module refactoring PRs, together with new tests.
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

describe('Request validation (e2e)', () => {
  let app: NestExpressApplication;
  // The in-memory HTTP server that supertest sends requests to.
  let server: ReturnType<NestExpressApplication['getHttpServer']>;
  let token: string;
  // A real post, so that only the field under test is ever invalid.
  let postId: number;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    await resetDatabase(app);
    token = await signIn(app, 'validator@gmail.com');
    postId = (await createPost(app, token)).id;
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Every validation error should look the same to the client: status 400 and
   * NestJS's standard error body, where `message` lists what was wrong.
   */
  function expectBadRequest(res: request.Response) {
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: expect.any(Array),
    });
  }

  describe('POST /post (CreatePostDto)', () => {
    it('rejects a post without a description', async () => {
      // Only an image, no `description` field.
      const res = await request(server)
        .post('/post')
        .set(bearer(token))
        .attach('files', TEST_IMAGE);

      expectBadRequest(res);
    });
  });

  describe('PATCH /post/description (UpdatePostDescriptionDto)', () => {
    it('rejects an update without a description', async () => {
      const res = await request(server)
        .patch('/post/description')
        .set(bearer(token))
        .send({ postId });

      expectBadRequest(res);
    });
  });

  describe('POST /comment (CreateCommentDto)', () => {
    it('rejects a comment without content', async () => {
      const res = await request(server)
        .post('/comment')
        .set(bearer(token))
        .send({ postId });

      expectBadRequest(res);
    });

    it('rejects a comment without postId', async () => {
      // Previously this reached `findOneBy({ id: undefined })` and returned 500.
      const res = await request(server)
        .post('/comment')
        .set(bearer(token))
        .send({ content: 'Hello' });

      expectBadRequest(res);
    });
  });

  describe('PATCH /comment (UpdateCommentDto)', () => {
    it('rejects an update without content', async () => {
      const comment = await createComment(app, token, postId);

      const res = await request(server)
        .patch('/comment')
        .set(bearer(token))
        .send({ id: comment.id });

      expectBadRequest(res);
    });
  });
});
