/**
 * ============================================================================
 *  PostReactionService unit tests (likes and bookmarks)
 * ============================================================================
 *
 * Same approach as the other service tests: the service is built with FAKE
 * dependencies, so only its own rules are tested, without a database:
 *   - the visibility check runs FIRST, and nothing is written when it fails
 *   - "set" methods (like / bookmark) only add, "unset" methods only remove
 *   - the old toggles remove when possible, and add otherwise
 *   - the responses report the resulting state
 *
 * That the database really keeps every one of many simultaneous likes is
 * checked by the e2e tests (test/post-reaction.e2e-spec.ts); a fake cannot
 * show that.
 *
 * Run with: npm test
 */
import { Logger, NotFoundException } from '@nestjs/common';
import { PostEntity } from '../post.entity';
import { PostRepository } from '../post.repository';
import { PostService } from '../post.service';
import { PostBookmark } from './post-bookmark.entity';
import { PostLike } from './post-like.entity';
import { PostReactionRepository } from './post-reaction.repository';
import { PostReactionService } from './post-reaction.service';

const VIEWER = 'viewer@gmail.com';
const POST_ID = 7;

describe('PostReactionService', () => {
  let reactionRepository: {
    add: jest.Mock;
    remove: jest.Mock;
    countLikes: jest.Mock;
  };
  let postRepository: {
    findPageOfBookmarkedPosts: jest.Mock;
    findBookmarkedPostIds: jest.Mock;
  };
  let postService: { getVisiblePostEntity: jest.Mock };
  let service: PostReactionService;

  // The toggles log what they do; keep the test output clean.
  beforeAll(() => Logger.overrideLogger(false));
  afterAll(() => Logger.overrideLogger(true));

  beforeEach(() => {
    reactionRepository = {
      add: jest.fn().mockResolvedValue(undefined),
      // By default there is nothing to remove.
      remove: jest.fn().mockResolvedValue(false),
      countLikes: jest.fn().mockResolvedValue(3),
    };
    postRepository = {
      findPageOfBookmarkedPosts: jest.fn(),
      findBookmarkedPostIds: jest.fn(),
    };
    // By default every post is visible.
    postService = {
      getVisiblePostEntity: jest.fn().mockResolvedValue({ id: POST_ID }),
    };
    service = new PostReactionService(
      reactionRepository as unknown as PostReactionRepository,
      postRepository as unknown as PostRepository,
      postService as unknown as PostService,
    );
  });

  /** Makes the visibility check fail, as for an unknown or hidden post. */
  const givenHiddenPost = () =>
    postService.getVisiblePostEntity.mockRejectedValue(new NotFoundException());

  // ==========================================================================
  //  Likes
  // ==========================================================================

  describe('likePost / unlikePost', () => {
    it('likePost adds a like row and reports the new state', async () => {
      await expect(service.likePost(POST_ID, VIEWER)).resolves.toEqual({
        postId: POST_ID,
        isLiked: true,
        likeCount: 3,
      });

      expect(postService.getVisiblePostEntity).toHaveBeenCalledWith(
        POST_ID,
        VIEWER,
      );
      expect(reactionRepository.add).toHaveBeenCalledWith(
        PostLike,
        VIEWER,
        POST_ID,
        expect.any(Date),
      );
      expect(reactionRepository.remove).not.toHaveBeenCalled();
    });

    it('unlikePost removes the like row and reports the new state', async () => {
      reactionRepository.countLikes.mockResolvedValue(2);

      await expect(service.unlikePost(POST_ID, VIEWER)).resolves.toEqual({
        postId: POST_ID,
        isLiked: false,
        likeCount: 2,
      });

      expect(reactionRepository.remove).toHaveBeenCalledWith(
        PostLike,
        VIEWER,
        POST_ID,
      );
      expect(reactionRepository.add).not.toHaveBeenCalled();
    });

    it('writes nothing for a hidden or unknown post (404)', async () => {
      givenHiddenPost();

      await expect(service.likePost(POST_ID, VIEWER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.unlikePost(POST_ID, VIEWER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(reactionRepository.add).not.toHaveBeenCalled();
      expect(reactionRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('toggleLike (old endpoint)', () => {
    it('adds the like when there was none to remove', async () => {
      reactionRepository.remove.mockResolvedValue(false);

      await expect(service.toggleLike(POST_ID, VIEWER)).resolves.toEqual({
        likeCount: 3,
      });
      expect(reactionRepository.add).toHaveBeenCalledWith(
        PostLike,
        VIEWER,
        POST_ID,
        expect.any(Date),
      );
    });

    it('only removes the like when there was one', async () => {
      reactionRepository.remove.mockResolvedValue(true);

      await service.toggleLike(POST_ID, VIEWER);

      expect(reactionRepository.add).not.toHaveBeenCalled();
    });

    it('writes nothing for a hidden or unknown post (404)', async () => {
      givenHiddenPost();

      await expect(service.toggleLike(POST_ID, VIEWER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(reactionRepository.remove).not.toHaveBeenCalled();
      expect(reactionRepository.add).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  //  Bookmarks
  // ==========================================================================

  describe('bookmarkPost / unbookmarkPost', () => {
    it('bookmarkPost adds a bookmark row', async () => {
      await expect(service.bookmarkPost(POST_ID, VIEWER)).resolves.toEqual({
        postId: POST_ID,
        isBookmarked: true,
      });
      expect(reactionRepository.add).toHaveBeenCalledWith(
        PostBookmark,
        VIEWER,
        POST_ID,
        expect.any(Date),
      );
    });

    it('unbookmarkPost removes the bookmark row', async () => {
      await expect(service.unbookmarkPost(POST_ID, VIEWER)).resolves.toEqual({
        postId: POST_ID,
        isBookmarked: false,
      });
      expect(reactionRepository.remove).toHaveBeenCalledWith(
        PostBookmark,
        VIEWER,
        POST_ID,
      );
    });

    it('writes nothing for a hidden or unknown post (404)', async () => {
      givenHiddenPost();

      await expect(
        service.bookmarkPost(POST_ID, VIEWER),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(reactionRepository.add).not.toHaveBeenCalled();
    });
  });

  describe('toggleBookmark (old endpoint)', () => {
    it('adds the bookmark when there was none to remove', async () => {
      reactionRepository.remove.mockResolvedValue(false);

      await service.toggleBookmark(POST_ID, VIEWER);

      expect(reactionRepository.add).toHaveBeenCalledWith(
        PostBookmark,
        VIEWER,
        POST_ID,
        expect.any(Date),
      );
    });

    it('only removes the bookmark when there was one', async () => {
      reactionRepository.remove.mockResolvedValue(true);

      await service.toggleBookmark(POST_ID, VIEWER);

      expect(reactionRepository.add).not.toHaveBeenCalled();
    });
  });

  describe('getBookmarkedPosts', () => {
    it('maps the repository page into the usual post list response', async () => {
      const post = {
        id: POST_ID,
        description: 'saved',
        user: { email: 'author@gmail.com', username: 'author' },
        isBookmarked: true,
      } as PostEntity;
      postRepository.findPageOfBookmarkedPosts.mockResolvedValue([[post], 1]);

      const result = await service.getBookmarkedPosts(VIEWER, 2, 10);

      expect(postRepository.findPageOfBookmarkedPosts).toHaveBeenCalledWith(
        VIEWER,
        2,
        10,
      );
      expect(result.total).toBe(1);
      expect(result.posts[0]).toMatchObject({
        id: POST_ID,
        isBookmarked: true,
        // Numbers the repository did not attach default to 0 / false.
        likeCount: 0,
        isLiked: false,
      });
    });
  });
});
