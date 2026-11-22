/**
 * ============================================================================
 *  PostReactionRepository: writing likes and bookmarks
 * ============================================================================
 *
 * Responsibility: database access for the join tables post_like and
 * post_bookmark, and nothing else. Who may like or bookmark which post is
 * decided in PostReactionService.
 *
 * (READING the numbers for post lists, e.g. likeCount / isLiked, happens in
 * PostRepository.attachStats, together with the posts themselves.)
 *
 * Every write is ONE SQL statement that the database performs atomically:
 *   - add    → INSERT … ON CONFLICT DO NOTHING  (adding twice is harmless)
 *   - remove → DELETE …                         (removing twice is harmless)
 * That is what makes simultaneous requests safe. The old code read an array,
 * changed it in JavaScript and wrote it back, so parallel requests
 * overwrote each other.
 *
 * Likes and bookmarks have the same table shape, so every method takes the
 * entity class (PostLike or PostBookmark) as its first argument instead of
 * existing twice.
 */
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PostBookmark } from './post-bookmark.entity';
import { PostLike } from './post-like.entity';

/** The two join tables this repository writes to. */
export type ReactionEntity = typeof PostLike | typeof PostBookmark;

@Injectable()
export class PostReactionRepository {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Stores "user → post" unless it is already stored.
   *
   * @param createdAt When the like / bookmark was made.
   */
  async add(
    entity: ReactionEntity,
    userEmail: string,
    postId: number,
    createdAt: Date,
  ): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(entity)
      .values({ userEmail, postId, createdAt })
      // ON CONFLICT DO NOTHING: the primary key (userEmail, postId) already
      // exists → the database skips the row instead of failing.
      .orIgnore()
      .execute();
  }

  /**
   * Removes "user → post".
   *
   * @returns `true` when a row was deleted, `false` when there was none.
   *          (The old toggle endpoints use this to decide between "remove"
   *          and "add".)
   */
  async remove(
    entity: ReactionEntity,
    userEmail: string,
    postId: number,
  ): Promise<boolean> {
    const result = await this.dataSource
      .getRepository(entity)
      .delete({ userEmail, postId });
    return (result.affected ?? 0) > 0;
  }

  /** How many users liked the post. */
  async countLikes(postId: number): Promise<number> {
    return this.dataSource.getRepository(PostLike).countBy({ postId });
  }
}
