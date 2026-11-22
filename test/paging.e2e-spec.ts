/**
 * ============================================================================
 *  Paging parameters e2e tests (`page` / `limit` on every list endpoint)
 * ============================================================================
 *
 * Every list endpoint takes `?page=<n>&limit=<n>`. Before this fix they only
 * checked that both were whole numbers, so:
 *   - page=0 or a negative page/limit reached the SQL query as a negative
 *     OFFSET / LIMIT, and PostgreSQL's error came back as 500 Internal Error
 *   - limit=0 returned an empty page (pointless, but "successful")
 *   - there was no upper bound: limit=1000000 loaded the whole table
 *
 * Now `page` must be ≥ 1 and `limit` between 1 and 100; anything else is a
 * client error (400) on EVERY list endpoint, checked here one by one.
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

describe('Paging parameters (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<NestExpressApplication['getHttpServer']>;
  let token: string;
  /** Every list endpoint, with the OTHER query parameters it needs. */
  let listEndpoints: { path: string; query: Record<string, string | number> }[];

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    await resetDatabase(app);

    token = await signIn(app, 'pager@gmail.com', 'Pager');
    await signIn(app, 'friend@gmail.com', 'Friend');

    // Real ids, so a valid request really answers 200 (not 404).
    const post = await createPost(app, token);
    const comment = await createComment(app, token, post.id, 'first');
    const room = await request(server)
      .post('/chat')
      .set(bearer(token))
      .send({ email: 'friend@gmail.com' })
      .expect(201);

    listEndpoints = [
      { path: '/post', query: {} },
      { path: '/post/my', query: {} },
      { path: '/post/user', query: { email: 'pager@gmail.com' } },
      { path: '/comment', query: { postId: post.id } },
      {
        path: '/comment/reply',
        query: { postId: post.id, parentCommentId: comment.id },
      },
      { path: '/follow/follower', query: { email: 'pager@gmail.com' } },
      { path: '/follow/following', query: { email: 'pager@gmail.com' } },
      { path: '/user/search/users', query: { keyword: '' } },
      { path: '/user/bookmarks', query: {} },
      { path: '/chat', query: {} },
      { path: '/message', query: { chatRoomId: room.body.id } },
    ];
  });

  afterAll(async () => {
    await app.close();
  });

  /** GET `path` with its own query plus the given page / limit; returns the status. */
  const statusOf = async (
    { path, query }: { path: string; query: Record<string, string | number> },
    page: number | string,
    limit: number | string,
  ) =>
    (
      await request(server)
        .get(path)
        .query({ ...query, page, limit })
        .set(bearer(token))
    ).status;

  // [description, page, limit, expected status]
  const cases: [string, number | string, number | string, number][] = [
    ['page=1&limit=10 is accepted', 1, 10, 200],
    ['limit=100 (the maximum) is accepted', 1, 100, 200],
    ['page=0 is rejected', 0, 10, 400],
    ['a negative page is rejected', -1, 10, 400],
    ['limit=0 is rejected', 1, 0, 400],
    ['a negative limit is rejected', 1, -5, 400],
    ['limit=101 (above the maximum) is rejected', 1, 101, 400],
    ['a non-numeric page is rejected', 'abc', 10, 400],
  ];

  it.each(cases)('%s on every list endpoint', async (_, page, limit, want) => {
    const results = await Promise.all(
      listEndpoints.map(async (endpoint) => ({
        path: endpoint.path,
        status: await statusOf(endpoint, page, limit),
      })),
    );

    // Compared as a whole list, so a failure names every endpoint at once.
    expect(results).toEqual(
      listEndpoints.map(({ path }) => ({ path, status: want })),
    );
  });
});
