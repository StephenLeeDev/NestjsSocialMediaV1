/**
 * ============================================================================
 *  PostService unit tests
 * ============================================================================
 *
 * Unit tests vs. e2e tests:
 *   - The e2e tests (test/post.e2e-spec.ts) run the whole app against a real
 *     database and check what a client sees over HTTP.
 *   - These UNIT tests check only PostService's own rules. The repository is
 *     replaced with a fake ("mock") whose answers each test controls, so:
 *       • no database is needed and the tests run in milliseconds
 *       • a test can create situations that are awkward over HTTP
 *         (e.g. "the repository returns a PRIVATE post written by someone else")
 *       • when a test fails, the bug is in PostService, not somewhere else
 *
 * Run with: npm test
 */
import {
  BadRequestException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '../user/user.entity';
import { UserRepository } from '../user/user.repository';
import { PostStatus } from './post-status.enum';
import { PostEntity } from './post.entity';
import { PostRepository } from './post.repository';
import { PostService } from './post.service';

// ----------------------------------------------------------------------------
//  Test data helpers
// ----------------------------------------------------------------------------

const AUTHOR = 'author@gmail.com';
const VIEWER = 'viewer@gmail.com';

/** Builds a user with just the fields PostService and the mapper read. */
function makeUser(email: string): User {
  return {
    email,
    username: email.split('@')[0],
    thumbnail: 'thumb.png',
  } as User;
}

/**
 * Builds a post as the repository would return it: PUBLIC, written by AUTHOR,
 * without numbers (likes etc. are attached by the fake `attachStats`). Pass `overrides` to change only what a test cares about.
 */
function makePost(overrides: Partial<PostEntity> = {}): PostEntity {
  return {
    id: 1,
    description: 'hello',
    status: PostStatus.PUBLIC,
    user: makeUser(AUTHOR),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    imageUrls: ['a.jpeg'],
    ...overrides,
  } as PostEntity;
}

// ----------------------------------------------------------------------------
//  The tests
// ----------------------------------------------------------------------------

describe('PostService', () => {
  // PostService logs what it does ("x liked post 1"). That is useful on a real
  // server but only clutters the test output, so logging is switched off here.
  beforeAll(() => Logger.overrideLogger(false));

  // The fake repository: every method PostService calls is a jest.fn(), so each
  // test can decide what it returns and later check how it was called.
  let postRepository: {
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    findOneBy: jest.Mock;
    findOneWithAuthor: jest.Mock;
    findPageOfPublicPosts: jest.Mock;
    attachStats: jest.Mock;
  };
  let service: PostService;

  beforeEach(() => {
    postRepository = {
      // `create` just returns the object it was given, like TypeORM does.
      create: jest.fn((data) => data),
      // `save` pretends the database assigned id 42.
      save: jest.fn(async (post) => Object.assign(post, { id: post.id ?? 42 })),
      delete: jest.fn(),
      findOneBy: jest.fn(),
      findOneWithAuthor: jest.fn(),
      findPageOfPublicPosts: jest.fn(),
      // Pretends the database computed these numbers for the viewer: one
      // like, by the viewer; not bookmarked; two comments.
      attachStats: jest.fn(async (posts: PostEntity[]) => {
        for (const post of posts) {
          Object.assign(post, {
            likeCount: 1,
            isLiked: true,
            isBookmarked: false,
            commentCount: 2,
          });
        }
      }),
    };

    // PostService is a plain class, so it can be constructed directly with the
    // fakes. The user repository is only used by createDummyPosts,
    // which is not unit tested here, so empty objects are enough.
    service = new PostService(
      postRepository as unknown as PostRepository,
      {} as UserRepository,
    );
  });

  describe('createPost', () => {
    it('saves a PUBLIC post without likes and returns it for the author', async () => {
      const result = await service.createPost(
        { description: 'new' },
        makeUser(AUTHOR),
        ['x.jpeg'],
      );

      expect(postRepository.save).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        id: 42,
        description: 'new',
        status: PostStatus.PUBLIC,
        imageUrls: ['x.jpeg'],
        likeCount: 0,
        isLiked: false,
        commentCount: 0,
        user: { email: AUTHOR },
      });
    });

    it('rejects a post without images and saves nothing', async () => {
      await expect(
        service.createPost({ description: 'new' }, makeUser(AUTHOR), []),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(postRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getPost', () => {
    it('returns a PUBLIC post to anyone', async () => {
      postRepository.findOneWithAuthor.mockResolvedValue(makePost());

      await expect(service.getPost(1, VIEWER)).resolves.toMatchObject({
        id: 1,
      });
    });

    it('returns a PRIVATE post to its author', async () => {
      postRepository.findOneWithAuthor.mockResolvedValue(
        makePost({ status: PostStatus.PRIVATE }),
      );

      await expect(service.getPost(1, AUTHOR)).resolves.toMatchObject({
        status: PostStatus.PRIVATE,
      });
    });

    it('hides a PRIVATE post from other users (404)', async () => {
      postRepository.findOneWithAuthor.mockResolvedValue(
        makePost({ status: PostStatus.PRIVATE }),
      );

      await expect(service.getPost(1, VIEWER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws 404 when the post does not exist', async () => {
      postRepository.findOneWithAuthor.mockResolvedValue(null);

      await expect(service.getPost(1, VIEWER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the numbers computed for the VIEWER', async () => {
      postRepository.findOneWithAuthor.mockResolvedValue(makePost());

      await expect(service.getPost(1, VIEWER)).resolves.toMatchObject({
        likeCount: 1,
        isLiked: true,
        isBookmarked: false,
        commentCount: 2,
      });
      // The numbers were computed for the viewer, not for the author.
      expect(postRepository.attachStats).toHaveBeenCalledWith(
        [expect.objectContaining({ id: 1 })],
        VIEWER,
      );
    });
  });

  describe('getPostsByAuthor', () => {
    it('asks the repository for the author, with the viewer for the flags', async () => {
      // The repository attaches the numbers itself for page queries.
      postRepository.findPageOfPublicPosts.mockResolvedValue([
        [makePost({ isLiked: true })],
        1,
      ]);

      const result = await service.getPostsByAuthor(AUTHOR, VIEWER, 2, 10);

      expect(postRepository.findPageOfPublicPosts).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        authorEmail: AUTHOR,
        viewerEmail: VIEWER,
      });
      expect(result.total).toBe(1);
      expect(result.posts[0].isLiked).toBe(true);
    });
  });

  describe('updateDescription', () => {
    it("updates the author's own post", async () => {
      postRepository.findOneWithAuthor.mockResolvedValue(makePost());

      const result = await service.updateDescription(AUTHOR, {
        postId: 1,
        description: 'edited',
      });

      expect(result.description).toBe('edited');
      expect(postRepository.save).toHaveBeenCalledTimes(1);
    });

    it("rejects someone else's post (401) and saves nothing", async () => {
      postRepository.findOneWithAuthor.mockResolvedValue(makePost());

      await expect(
        service.updateDescription(VIEWER, { postId: 1, description: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(postRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('togglePostStatus', () => {
    it('switches PUBLIC to PRIVATE and back for the author', async () => {
      const post = makePost();
      postRepository.findOneWithAuthor.mockResolvedValue(post);

      await service.togglePostStatus(1, AUTHOR);
      expect(post.status).toBe(PostStatus.PRIVATE);

      await service.togglePostStatus(1, AUTHOR);
      expect(post.status).toBe(PostStatus.PUBLIC);
    });

    it("rejects someone else's post (401) and leaves it unchanged", async () => {
      const post = makePost();
      postRepository.findOneWithAuthor.mockResolvedValue(post);

      await expect(service.togglePostStatus(1, VIEWER)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(post.status).toBe(PostStatus.PUBLIC);
      expect(postRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('deletePost', () => {
    it('deletes only posts owned by the given user', async () => {
      postRepository.delete.mockResolvedValue({ affected: 1 });
      const author = makeUser(AUTHOR);

      await service.deletePost(1, author);

      // The ownership check happens in the DELETE condition itself.
      expect(postRepository.delete).toHaveBeenCalledWith({
        id: 1,
        user: author,
      });
    });

    it('throws 404 when nothing was deleted', async () => {
      postRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(
        service.deletePost(1, makeUser(VIEWER)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
