/**
 * ============================================================================
 *  Images e2e tests: how image references are stored, and upload cleanup
 * ============================================================================
 *
 * Two bugs are covered here.
 *
 * 1. Image references were stored as FULL URLs, including the server address
 *    at upload time (e.g. "http://192.168.1.251:3001/images/123.jpeg").
 *    When the server moved, every existing image link broke. Now only the
 *    path inside the images folder is stored ("123.jpeg", "dummy/6.jpeg"),
 *    and the full URL is built from the CURRENT SERVER_URL in each response.
 *
 * 2. Uploaded files were never deleted: deleting a post or replacing a
 *    profile picture left the old files on disk forever. Now a file is
 *    deleted as soon as nothing refers to it anymore. The bundled images
 *    (static/images/default and static/images/dummy) are never deleted.
 *
 * Uploads go to a temporary folder in these tests (UPLOAD_DIR, set in
 * test/setup-env.ts), so the project's static folder is never touched.
 */
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'fs';
import { basename, join } from 'path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PostEntity } from '../src/post/post.entity';
import { User } from '../src/user/user.entity';
import {
  bearer,
  createPost,
  createTestApp,
  resetDatabase,
  signIn,
  TEST_IMAGE,
} from './utils/test-app';

/** Where the bundled images live (default picture, dummy pictures). */
const STATIC_IMAGES = join(__dirname, '..', 'static', 'images');

describe('Images (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<NestExpressApplication['getHttpServer']>;
  let token: string;
  const uploadDir = () => process.env.UPLOAD_DIR as string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    await resetDatabase(app);
    token = await signIn(app, 'painter@gmail.com', 'Painter');
  });

  afterAll(async () => {
    await app.close();
  });

  /** The stored row of a user / post, read directly from the database. */
  const storedUser = (email: string) =>
    app.get(DataSource).getRepository(User).findOneByOrFail({ email });
  const storedPost = (id: number) =>
    app.get(DataSource).getRepository(PostEntity).findOneByOrFail({ id });

  /** Is this uploaded file (given by its public URL) still on disk? */
  const uploadedFileExists = (url: string) =>
    existsSync(join(uploadDir(), basename(url)));

  /** PATCH /user/thumbnail with the test image; returns the new URL. */
  const uploadThumbnail = async (asToken = token): Promise<string> =>
    (
      await request(server)
        .patch('/user/thumbnail')
        .set(bearer(asToken))
        .attach('file', TEST_IMAGE)
        .expect(200)
    ).body.updatedThumbnail;

  // ==========================================================================
  //  1. What is stored, and how URLs are built
  // ==========================================================================

  describe('stored image references', () => {
    it('stores post images and thumbnails as paths, not full URLs', async () => {
      const post = await createPost(app, token);
      const uploaded = await uploadThumbnail();

      // The response still contains full URLs ...
      expect(post.imageUrls[0]).toMatch(
        /^https?:\/\/.+\/images\/[\w-]+\.jpeg$/,
      );
      expect(uploaded).toMatch(/^https?:\/\/.+\/images\/[\w-]+\.jpeg$/);

      // ... but the database only keeps the file name.
      expect((await storedPost(post.id)).imageUrls).toEqual([
        basename(post.imageUrls[0]),
      ]);
      expect((await storedUser('painter@gmail.com')).thumbnail).toBe(
        basename(uploaded),
      );
    });

    it('stores the default picture of a new account as a path', async () => {
      await signIn(app, 'newcomer@gmail.com');

      expect((await storedUser('newcomer@gmail.com')).thumbnail).toBe(
        'default/dafault_thumbnail.png',
      );
    });

    it('builds response URLs from the CURRENT server address', async () => {
      // Simulates moving the server: images uploaded before the move must
      // be served from the new address.
      const post = await createPost(app, token);
      const original = process.env.SERVER_URL;
      process.env.SERVER_URL = 'https://new-host.example';
      try {
        const fetched = await request(server)
          .get(`/post/${post.id}`)
          .set(bearer(token))
          .expect(200);
        expect(fetched.body.imageUrls[0]).toBe(
          `https://new-host.example/images/${basename(post.imageUrls[0])}`,
        );

        const profile = await request(server)
          .get('/user')
          .set(bearer(token))
          .expect(200);
        expect(profile.body.thumbnail).toMatch(
          /^https:\/\/new-host\.example\/images\//,
        );
      } finally {
        process.env.SERVER_URL = original;
      }
    });
  });

  describe('upload file names', () => {
    it('gives every image of one post its own file', async () => {
      // Upload file names used to be just the current time in milliseconds.
      // Images uploaded in the same request usually got the SAME name, so
      // the last one overwrote the others on disk and the post showed one
      // picture several times.
      const res = await request(server)
        .post('/post')
        .set(bearer(token))
        .field('description', 'three pictures')
        .attach('files', TEST_IMAGE)
        .attach('files', TEST_IMAGE)
        .attach('files', TEST_IMAGE)
        .expect(201);

      const names = res.body.imageUrls.map((url: string) => basename(url));
      expect(new Set(names).size).toBe(3);
      for (const url of res.body.imageUrls) {
        expect(uploadedFileExists(url)).toBe(true);
      }
    });
  });

  // ==========================================================================
  //  2. Deleting files nothing refers to anymore
  // ==========================================================================

  describe('uploaded file cleanup', () => {
    it("deletes a post's uploaded images together with the post", async () => {
      const post = await createPost(app, token);
      expect(uploadedFileExists(post.imageUrls[0])).toBe(true);

      await request(server)
        .delete(`/post/${post.id}`)
        .set(bearer(token))
        .expect(200);

      expect(uploadedFileExists(post.imageUrls[0])).toBe(false);
    });

    it('keeps the files when deleting is refused (not your post)', async () => {
      const post = await createPost(app, token);
      const intruder = await signIn(app, 'intruder@gmail.com');

      await request(server)
        .delete(`/post/${post.id}`)
        .set(bearer(intruder))
        .expect(404);

      expect(uploadedFileExists(post.imageUrls[0])).toBe(true);
    });

    it('deletes the previous profile picture when it is replaced or reset', async () => {
      const owner = await signIn(app, 'selfie@gmail.com');
      const first = await uploadThumbnail(owner);
      const second = await uploadThumbnail(owner);

      // Replaced: the first file is gone, the current one stays.
      expect(uploadedFileExists(first)).toBe(false);
      expect(uploadedFileExists(second)).toBe(true);

      // Reset to the default picture: the uploaded file is gone too ...
      await request(server)
        .delete('/user/thumbnail')
        .set(bearer(owner))
        .expect(200);
      expect(uploadedFileExists(second)).toBe(false);

      // ... and resetting again never touches the bundled default picture.
      await request(server)
        .delete('/user/thumbnail')
        .set(bearer(owner))
        .expect(200);
      expect(
        existsSync(join(STATIC_IMAGES, 'default', 'dafault_thumbnail.png')),
      ).toBe(true);
    });

    it('never deletes the bundled dummy images', async () => {
      // A dummy user starts with a bundled picture from static/images/dummy.
      await request(server).post('/auth/test/dummy').expect(201);
      const mike = await storedUser('mike@gmail.com');
      expect(mike.thumbnail).toMatch(/^dummy\/\d+\.jpeg$/);
      const mikeToken = await signIn(app, 'mike@gmail.com', 'Mike');

      // Replacing it must not delete the shared bundled file.
      await uploadThumbnail(mikeToken);
      expect(existsSync(join(STATIC_IMAGES, mike.thumbnail))).toBe(true);

      // Same for a dummy post's images when the post is deleted.
      await request(server)
        .post('/post/test/dummy')
        .query({ email: 'mike@gmail.com' })
        .set(bearer(mikeToken))
        .expect(201);
      const [dummyPost] = await app
        .get(DataSource)
        .getRepository(PostEntity)
        .find({ where: { user: { email: 'mike@gmail.com' } }, take: 1 });
      await request(server)
        .delete(`/post/${dummyPost.id}`)
        .set(bearer(mikeToken))
        .expect(200);
      for (const image of dummyPost.imageUrls) {
        expect(existsSync(join(STATIC_IMAGES, image))).toBe(true);
      }
    });
  });
});
