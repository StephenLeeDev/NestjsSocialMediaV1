/**
 * ============================================================================
 *  CommentService unit tests
 * ============================================================================
 *
 * Same approach as post.service.spec.ts: CommentService is built with FAKE
 * dependencies, so these tests check only its own rules, without a database:
 *   - the post must be visible (the fake PostService decides)
 *   - which parent comments a reply may have
 *   - author checks for editing, ownership for deleting
 *
 * Run with: npm test
 */
import {
  BadRequestException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthRepository } from '../auth/auth.repository';
import { PostEntity } from '../post/post.entity';
import { PostService } from '../post/post.service';
import { User } from '../user/user.entity';
import { UserRepository } from '../user/user.repository';
import { CommentType } from './comment-type.enum';
import { CommentEntity } from './comment.entity';
import { CommentRepository } from './comment.repository';
import { CommentService } from './comment.service';

// ----------------------------------------------------------------------------
//  Test data helpers
// ----------------------------------------------------------------------------

const AUTHOR = 'author@gmail.com';
const OTHER = 'other@gmail.com';

/** Builds a user with just the fields the service and the mapper read. */
function makeUser(email: string): User {
  return {
    email,
    username: email.split('@')[0],
    thumbnail: 'thumb.png',
  } as User;
}

/** A post with the given id (the service only needs `id`). */
function makePost(id = 1): PostEntity {
  return { id } as PostEntity;
}

/**
 * A top-level comment by AUTHOR on post 1, as the repository returns it.
 * Pass `overrides` to change only what a test cares about.
 */
function makeComment(overrides: Partial<CommentEntity> = {}): CommentEntity {
  return {
    id: 7,
    content: 'hello',
    type: CommentType.Comment,
    parentCommentId: null,
    parentCommentAuthor: null,
    post: makePost(1),
    user: makeUser(AUTHOR),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    childrenCount: 0,
    ...overrides,
  } as CommentEntity;
}

// ----------------------------------------------------------------------------
//  The tests
// ----------------------------------------------------------------------------

describe('CommentService', () => {
  // The service logs what it does; keep the test output clean.
  beforeAll(() => Logger.overrideLogger(false));

  let commentRepository: {
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    findOneWithAuthor: jest.Mock;
    findCommentsPage: jest.Mock;
    findRepliesPage: jest.Mock;
  };
  let postService: { getVisiblePostEntity: jest.Mock };
  let service: CommentService;

  beforeEach(() => {
    commentRepository = {
      // `create` returns what it was given, like TypeORM does.
      create: jest.fn((data) => data),
      // `save` pretends the database assigned id 100.
      save: jest.fn(async (c) => Object.assign(c, { id: c.id ?? 100 })),
      delete: jest.fn(),
      findOneWithAuthor: jest.fn(),
      findCommentsPage: jest.fn(),
      findRepliesPage: jest.fn(),
    };
    // By default every post is visible and has id 1.
    postService = {
      getVisiblePostEntity: jest.fn().mockResolvedValue(makePost(1)),
    };

    service = new CommentService(
      commentRepository as unknown as CommentRepository,
      postService as unknown as PostService,
      {} as UserRepository, // only used by createDummyComments
      {} as AuthRepository, // only used by createDummyComments
    );
  });

  describe('createComment', () => {
    it('creates a top-level COMMENT when no parent is given', async () => {
      const result = await service.createComment(
        { content: 'hi', postId: 1 },
        makeUser(OTHER),
      );

      expect(result).toMatchObject({
        id: 100,
        type: CommentType.Comment,
        parentCommentId: null,
        parentCommentAuthor: null,
        postId: 1,
        childrenCount: 0,
        user: { email: OTHER },
      });
    });

    it("creates a REPLY and copies the parent's REAL author", async () => {
      commentRepository.findOneWithAuthor.mockResolvedValue(makeComment());

      const result = await service.createComment(
        {
          content: 'hi',
          postId: 1,
          parentCommentId: 7,
          // A wrong value from the client must be ignored.
          parentCommentAuthor: 'liar@gmail.com',
        },
        makeUser(OTHER),
      );

      expect(result).toMatchObject({
        type: CommentType.Reply,
        parentCommentId: 7,
        parentCommentAuthor: AUTHOR,
      });
    });

    it('fails with 404 when the post is not visible (and saves nothing)', async () => {
      postService.getVisiblePostEntity.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.createComment({ content: 'hi', postId: 1 }, makeUser(OTHER)),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(commentRepository.save).not.toHaveBeenCalled();
    });

    it('fails with 404 when the parent comment does not exist', async () => {
      commentRepository.findOneWithAuthor.mockResolvedValue(null);

      await expect(
        service.createComment(
          { content: 'hi', postId: 1, parentCommentId: 7 },
          makeUser(OTHER),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('fails with 400 when the parent is on another post', async () => {
      commentRepository.findOneWithAuthor.mockResolvedValue(
        makeComment({ post: makePost(2) }),
      );

      await expect(
        service.createComment(
          { content: 'hi', postId: 1, parentCommentId: 7 },
          makeUser(OTHER),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('fails with 400 when the parent is itself a reply', async () => {
      commentRepository.findOneWithAuthor.mockResolvedValue(
        makeComment({ type: CommentType.Reply, parentCommentId: 3 }),
      );

      await expect(
        service.createComment(
          { content: 'hi', postId: 1, parentCommentId: 7 },
          makeUser(OTHER),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getComments / getReplies', () => {
    it('checks visibility, then maps the page', async () => {
      commentRepository.findCommentsPage.mockResolvedValue([
        [makeComment({ childrenCount: 2 })],
        1,
      ]);

      const result = await service.getComments(1, OTHER, 1, 10);

      expect(postService.getVisiblePostEntity).toHaveBeenCalledWith(1, OTHER);
      expect(result).toEqual({
        comments: [expect.objectContaining({ id: 7, childrenCount: 2 })],
        total: 1,
      });
    });

    it('does not query replies of a hidden post', async () => {
      postService.getVisiblePostEntity.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.getReplies(7, 1, OTHER, 1, 10),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(commentRepository.findRepliesPage).not.toHaveBeenCalled();
    });
  });

  describe('updateComment', () => {
    it("updates the author's own comment", async () => {
      commentRepository.findOneWithAuthor.mockResolvedValue(makeComment());

      const result = await service.updateComment(
        { id: 7, content: 'edited' },
        makeUser(AUTHOR),
      );

      expect(result.content).toBe('edited');
      expect(commentRepository.save).toHaveBeenCalledTimes(1);
    });

    it('fails with 404 when the comment does not exist', async () => {
      commentRepository.findOneWithAuthor.mockResolvedValue(null);

      await expect(
        service.updateComment({ id: 7, content: 'x' }, makeUser(AUTHOR)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("fails with 401 for someone else's comment (and saves nothing)", async () => {
      commentRepository.findOneWithAuthor.mockResolvedValue(makeComment());

      await expect(
        service.updateComment({ id: 7, content: 'x' }, makeUser(OTHER)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(commentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteComment', () => {
    it('deletes only comments owned by the given user', async () => {
      commentRepository.delete.mockResolvedValue({ affected: 1 });
      const author = makeUser(AUTHOR);

      await service.deleteComment(7, author);

      expect(commentRepository.delete).toHaveBeenCalledWith({
        id: 7,
        user: author,
      });
    });

    it('fails with 404 when nothing was deleted', async () => {
      commentRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(
        service.deleteComment(7, makeUser(OTHER)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
