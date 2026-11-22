/**
 * ============================================================================
 *  PostReactionService: the rules for likes and bookmarks
 * ============================================================================
 *
 *   PostReactionController   → HTTP only (PUT / DELETE /post/:id/like|bookmark,
 *        │                     old POST /post/:postId/like)
 *   UserController           → GET /user/bookmarks, old POST /user/post/bookmark
 *        │
 *   PostReactionService      → rules (THIS FILE)
 *        │                     - only posts the viewer may see can be liked or
 *        │                       bookmarked (404 otherwise, same rule as
 *        │                       everywhere: PostService.getVisiblePostEntity)
 *        │                     - liking / bookmarking twice is harmless
 *        │                     - the responses report the resulting state
 *        │
 *   PostReactionRepository   → INSERT / DELETE on post_like and post_bookmark
 *   PostRepository           → the "my bookmarks" list (it returns posts)
 *
 * Likes and bookmarks are stored in the join tables post_like and
 * post_bookmark (see post-like.entity.ts for why they replaced the arrays).
 *
 * TWO STYLES OF ENDPOINT
 *   New (recommended): "set" endpoints. PUT = make it so, DELETE = undo.
 *     Sending the same request twice gives the same result ("idempotent"),
 *     so a double tap or a network retry can never undo the user's action.
 *   Old (kept until the Flutter app has switched): "toggle" endpoints.
 *     They flip the current state. They are implemented on top of the same
 *     tables, so they are now safe under concurrency as well.
 */
import { Injectable, Logger } from '@nestjs/common';
import { currentSeoulTimestamp } from '../../common/utils/date.util';
import { PostResponse } from '../dto/post-info.dto';
import { PostLikeCountDto } from '../dto/post-like-count.dto';
import { toPostInfoDto } from '../post.mapper';
import { PostRepository } from '../post.repository';
import { PostService } from '../post.service';
import {
  PostBookmarkStateDto,
  PostLikeStateDto,
} from './dto/post-reaction-state.dto';
import { PostBookmark } from './post-bookmark.entity';
import { PostLike } from './post-like.entity';
import { PostReactionRepository } from './post-reaction.repository';

@Injectable()
export class PostReactionService {
  private readonly logger = new Logger(PostReactionService.name);

  constructor(
    private readonly reactionRepository: PostReactionRepository,
    private readonly postRepository: PostRepository,
    // Owns the visibility rule ("PRIVATE posts exist only for their author").
    private readonly postService: PostService,
  ) {}

  // ==========================================================================
  //  Likes
  // ==========================================================================

  /**
   * PUT /post/:id/like: the viewer likes the post (again: no change).
   *
   * @throws NotFoundException (404) when the post is missing or hidden.
   */
  async likePost(
    postId: number,
    viewerEmail: string,
  ): Promise<PostLikeStateDto> {
    await this.postService.getVisiblePostEntity(postId, viewerEmail);
    await this.reactionRepository.add(PostLike, viewerEmail, postId, now());
    return this.likeState(postId, true);
  }

  /**
   * DELETE /post/:id/like: the viewer removes their like (none: no change).
   *
   * @throws NotFoundException (404) when the post is missing or hidden.
   */
  async unlikePost(
    postId: number,
    viewerEmail: string,
  ): Promise<PostLikeStateDto> {
    await this.postService.getVisiblePostEntity(postId, viewerEmail);
    await this.reactionRepository.remove(PostLike, viewerEmail, postId);
    return this.likeState(postId, false);
  }

  /**
   * OLD POST /post/:postId/like: removes the viewer's like if there is one,
   * otherwise adds it.
   *
   * "Try to delete, and insert if nothing was deleted" needs no separate
   * lookup, and each step is a single atomic statement.
   *
   * @returns The new like count (the old response shape).
   * @throws NotFoundException (404) when the post is missing or hidden. (The
   *         old code skipped the visibility check, so anyone could like a
   *         PRIVATE post by guessing its id.)
   */
  async toggleLike(
    postId: number,
    viewerEmail: string,
  ): Promise<PostLikeCountDto> {
    await this.postService.getVisiblePostEntity(postId, viewerEmail);

    const removed = await this.reactionRepository.remove(
      PostLike,
      viewerEmail,
      postId,
    );
    if (!removed) {
      await this.reactionRepository.add(PostLike, viewerEmail, postId, now());
    }
    this.logger.verbose(
      `${viewerEmail} ${removed ? 'unliked' : 'liked'} post ${postId}`,
    );

    const result = new PostLikeCountDto();
    result.likeCount = await this.reactionRepository.countLikes(postId);
    return result;
  }

  // ==========================================================================
  //  Bookmarks
  // ==========================================================================

  /**
   * PUT /post/:id/bookmark: the viewer saves the post (again: no change).
   *
   * @throws NotFoundException (404) when the post is missing or hidden.
   */
  async bookmarkPost(
    postId: number,
    viewerEmail: string,
  ): Promise<PostBookmarkStateDto> {
    await this.postService.getVisiblePostEntity(postId, viewerEmail);
    await this.reactionRepository.add(PostBookmark, viewerEmail, postId, now());
    return { postId, isBookmarked: true };
  }

  /**
   * DELETE /post/:id/bookmark: the viewer removes the post from their
   * bookmarks (not bookmarked: no change).
   *
   * @throws NotFoundException (404) when the post is missing or hidden.
   */
  async unbookmarkPost(
    postId: number,
    viewerEmail: string,
  ): Promise<PostBookmarkStateDto> {
    await this.postService.getVisiblePostEntity(postId, viewerEmail);
    await this.reactionRepository.remove(PostBookmark, viewerEmail, postId);
    return { postId, isBookmarked: false };
  }

  /**
   * OLD POST /user/post/bookmark: removes the bookmark if there is one,
   * otherwise adds it (same approach as toggleLike).
   *
   * @throws NotFoundException (404) when the post is missing or hidden.
   */
  async toggleBookmark(postId: number, viewerEmail: string): Promise<void> {
    await this.postService.getVisiblePostEntity(postId, viewerEmail);

    const removed = await this.reactionRepository.remove(
      PostBookmark,
      viewerEmail,
      postId,
    );
    if (!removed) {
      await this.reactionRepository.add(
        PostBookmark,
        viewerEmail,
        postId,
        now(),
      );
    }
  }

  /**
   * GET /user/bookmarks: one page of the viewer's bookmarked posts, the most
   * recently bookmarked first. Posts the viewer can no longer see are left
   * out (see PostRepository.findPageOfBookmarkedPosts).
   */
  async getBookmarkedPosts(
    viewerEmail: string,
    page: number,
    limit: number,
  ): Promise<PostResponse> {
    const [posts, total] = await this.postRepository.findPageOfBookmarkedPosts(
      viewerEmail,
      page,
      limit,
    );
    return { posts: posts.map(toPostInfoDto), total };
  }

  /**
   * The ids of the viewer's bookmarked posts, for the OLD `bookMarks` field
   * of GET /user. Same visibility rule as getBookmarkedPosts.
   */
  getBookmarkedPostIds(viewerEmail: string): Promise<number[]> {
    return this.postRepository.findBookmarkedPostIds(viewerEmail);
  }

  // ==========================================================================
  //  Helpers
  // ==========================================================================

  /** The like response: the viewer's new state plus the current count. */
  private async likeState(
    postId: number,
    isLiked: boolean,
  ): Promise<PostLikeStateDto> {
    const likeCount = await this.reactionRepository.countLikes(postId);
    return { postId, isLiked, likeCount };
  }
}

/** The current time as stored everywhere (Seoul local time; see date.util.ts). */
function now(): Date {
  return new Date(currentSeoulTimestamp());
}
