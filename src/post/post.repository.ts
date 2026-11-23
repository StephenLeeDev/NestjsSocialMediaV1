/**
 * ============================================================================
 *  PostRepository: database access for posts
 * ============================================================================
 *
 * Responsibility: talking to the database, and nothing else.
 *   - It knows HOW to load and count posts (SQL / query builder).
 *   - It does NOT decide business rules (who may edit, what counts as a like,
 *     what the API response looks like). Those live in PostService and
 *     post.mapper.ts.
 *
 * It extends TypeORM's `Repository<PostEntity>`, so the standard methods
 * (`findOneBy`, `save`, `create`, `delete`, ...) are available as well, next to
 * the custom queries below.
 */
import { Injectable } from '@nestjs/common';
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import { CommentEntity } from '../comment/comment.entity';
import { PostStatus } from './post-status.enum';
import { PostEntity } from './post.entity';
import { PostBookmark } from './reaction/post-bookmark.entity';
import { PostLike } from './reaction/post-like.entity';

/** Options for loading one page of a post list. */
export interface PostPageQuery {
  /** 1-based page number (page 1 = newest posts). */
  page: number;
  /** How many posts one page contains. */
  limit: number;
  /** When given, only posts written by this user are returned. */
  authorEmail?: string;
  /**
   * The user looking at the list. `isLiked` / `isBookmarked` are computed
   * for this user (see attachStats).
   */
  viewerEmail: string;
}

@Injectable()
export class PostRepository extends Repository<PostEntity> {
  constructor(dataSource: DataSource) {
    // A custom repository is a normal TypeORM Repository bound to PostEntity.
    // (The old `@EntityRepository` decorator was removed in TypeORM 0.3.)
    super(PostEntity, dataSource.createEntityManager());
  }

  // ==========================================================================
  //  Queries used by PostService
  // ==========================================================================

  /**
   * Loads one page of PUBLIC posts, newest first, together with their authors
   * and their numbers (comments, likes, the viewer's like and bookmark).
   *
   * @returns `[posts on this page, total number of matching posts]`. The total
   *          lets the client know how many pages exist.
   */
  async findPageOfPublicPosts({
    page,
    limit,
    authorEmail,
    viewerEmail,
  }: PostPageQuery): Promise<[PostEntity[], number]> {
    const query = this.postWithAuthorQuery()
      .where('post.status = :status', { status: PostStatus.PUBLIC })
      .orderBy('post.createdAt', 'DESC')
      // Page 1 skips 0 rows, page 2 skips `limit` rows, and so on.
      .skip((page - 1) * limit)
      .take(limit);

    if (authorEmail) {
      query.andWhere('user.email = :authorEmail', { authorEmail });
    }

    // One call returns both the rows of this page and the total count.
    const [posts, total] = await query.getManyAndCount();
    await this.attachStats(posts, viewerEmail);
    return [posts, total];
  }

  /**
   * One page of the posts `viewerEmail` bookmarked, the most recently
   * bookmarked first.
   *
   * Only posts the viewer may see are included: PUBLIC posts, and the
   * viewer's own posts (also PRIVATE ones). A post another user made PRIVATE
   * after it was bookmarked disappears from the list, but the bookmark row is
   * kept; it shows up again if the author makes the post PUBLIC again.
   * Deleted posts cannot appear: their bookmark rows are deleted with them.
   *
   * SQL (simplified):
   *   SELECT post.*, author.* FROM post_entity post
   *   JOIN "user" author          ON author.email = post."userEmail"
   *   JOIN post_bookmark bookmark ON bookmark."postId" = post.id
   *                              AND bookmark."userEmail" = :viewer
   *   WHERE post.status = 'PUBLIC' OR author.email = :viewer
   *   ORDER BY bookmark."createdAt" DESC, post.id DESC
   *   OFFSET … LIMIT …
   */
  async findPageOfBookmarkedPosts(
    viewerEmail: string,
    page: number,
    limit: number,
  ): Promise<[PostEntity[], number]> {
    const [posts, total] = await this.postWithAuthorQuery()
      // PostBookmark has no relation declared on PostEntity, so the join
      // names the entity and writes the ON condition itself.
      .innerJoin(
        PostBookmark,
        'bookmark',
        'bookmark.postId = post.id AND bookmark.userEmail = :viewerEmail',
        { viewerEmail },
      )
      .where(this.visibleTo('viewerEmail'))
      .orderBy('bookmark.createdAt', 'DESC')
      // Two bookmarks made in the same millisecond still have a fixed order.
      .addOrderBy('post.id', 'DESC')
      // `offset` / `limit` (plain SQL paging) instead of `skip` / `take`:
      // every join here yields at most ONE row per post (one author, one
      // bookmark of this viewer), so TypeORM's extra "skip/take" query for
      // joins that multiply rows is not needed. It also cannot order by a
      // column of a joined entity that is not selected (bookmark.createdAt).
      .offset((page - 1) * limit)
      .limit(limit)
      .getManyAndCount();

    await this.attachStats(posts, viewerEmail);
    return [posts, total];
  }

  /**
   * The ids of the posts `viewerEmail` bookmarked and may still see (same
   * rule as findPageOfBookmarkedPosts), oldest bookmark first.
   *
   * Only used for the old `bookMarks` field of GET /user, which the current
   * Flutter app reads. New clients should use GET /user/bookmarks.
   */
  async findBookmarkedPostIds(viewerEmail: string): Promise<number[]> {
    const rows: { id: number }[] = await this.createQueryBuilder('post')
      .leftJoin('post.user', 'user')
      .innerJoin(
        PostBookmark,
        'bookmark',
        'bookmark.postId = post.id AND bookmark.userEmail = :viewerEmail',
        { viewerEmail },
      )
      .select('post.id', 'id')
      .where(this.visibleTo('viewerEmail'))
      // Oldest first, matching the order of the old array (new ids were
      // appended at the end).
      .orderBy('bookmark.createdAt', 'ASC')
      .addOrderBy('post.id', 'ASC')
      .getRawMany();
    return rows.map((row) => Number(row.id));
  }

  /**
   * Loads a single post (PUBLIC or PRIVATE) with its author.
   * Returns `null` when no post has this id; deciding what that means (404) is
   * the service's job.
   *
   * The numbers (comments, likes, ...) are NOT loaded here: many callers only
   * need to know that the post exists and who wrote it (e.g. every comment
   * request). Call `attachStats` when the post is returned to the client.
   */
  async findOneWithAuthor(id: number): Promise<PostEntity | null> {
    return this.postWithAuthorQuery().where('post.id = :id', { id }).getOne();
  }

  /**
   * Deletes a post, but only if `authorEmail` wrote it, and returns the
   * image paths the deleted post had (so the caller can delete the files).
   *
   *   DELETE FROM post_entity WHERE id = :id AND "userEmail" = :authorEmail
   *   RETURNING "imageUrls"
   *
   * `RETURNING` hands back the deleted row's values in the SAME statement,
   * so there is no gap between "read the image list" and "delete the post"
   * in which the post could change.
   *
   * Comments, replies, likes and bookmarks of the post are deleted by the
   * database through their foreign keys (ON DELETE CASCADE).
   *
   * @returns The deleted post's image paths, or `null` when no post with this
   *          id was written by `authorEmail` (nothing was deleted).
   */
  async deleteOwnPost(
    id: number,
    authorEmail: string,
  ): Promise<string[] | null> {
    const result = await this.createQueryBuilder()
      .delete()
      .from(PostEntity)
      .where('id = :id', { id })
      // DELETE cannot join, so the foreign key column is used directly.
      .andWhere('"userEmail" = :authorEmail', { authorEmail })
      .returning(['imageUrls'])
      .execute();

    const rows = result.raw as { imageUrls: string[] }[];
    return rows.length > 0 ? rows[0].imageUrls : null;
  }

  /**
   * Fills in the non-column fields `commentCount`, `likeCount`, `isLiked`
   * and `isBookmarked` on each post, as seen by `viewerEmail`.
   *
   * Four small queries cover the WHOLE list, whatever its length (instead of
   * four queries per post), and they run in parallel because they do not
   * depend on each other:
   *
   *   1. SELECT "postId", COUNT(*) FROM comment_entity WHERE "postId" IN (…) GROUP BY "postId"
   *   2. SELECT "postId", COUNT(*) FROM post_like      WHERE "postId" IN (…) GROUP BY "postId"
   *   3. SELECT "postId" FROM post_like     WHERE "userEmail" = :viewer AND "postId" IN (…)
   *   4. SELECT "postId" FROM post_bookmark WHERE "userEmail" = :viewer AND "postId" IN (…)
   *
   * Before the join tables, the post rows carried the full lists of emails
   * that liked / bookmarked them, and these numbers were computed in memory
   * from those lists. A popular post therefore made every feed page heavier.
   */
  async attachStats(posts: PostEntity[], viewerEmail: string): Promise<void> {
    if (posts.length === 0) return;
    const ids = posts.map((post) => post.id);

    const [commentCounts, likeCounts, likedIds, bookmarkedIds] =
      await Promise.all([
        this.countPerPost(CommentEntity, 'comment', ids),
        this.countPerPost(PostLike, 'post_like', ids),
        this.postIdsMarkedBy(PostLike, viewerEmail, ids),
        this.postIdsMarkedBy(PostBookmark, viewerEmail, ids),
      ]);

    for (const post of posts) {
      post.commentCount = commentCounts.get(post.id) ?? 0;
      post.likeCount = likeCounts.get(post.id) ?? 0;
      post.isLiked = likedIds.has(post.id);
      post.isBookmarked = bookmarkedIds.has(post.id);
    }
  }

  // ==========================================================================
  //  Internal helpers
  // ==========================================================================

  /**
   * The common starting point for every post query: the post joined with its
   * author, selecting only the columns the API needs.
   *
   * Selecting explicit columns keeps the author's private data (bookmarks,
   * social type, ...) out of the result, and keeps the query small.
   */
  private postWithAuthorQuery(): SelectQueryBuilder<PostEntity> {
    return this.createQueryBuilder('post')
      .leftJoin('post.user', 'user')
      .select([
        'post.id',
        'post.description',
        'post.status',
        'post.createdAt',
        'post.updatedAt',
        'post.imageUrls',
        'user.username',
        'user.email',
        'user.thumbnail',
      ]);
  }

  /**
   * The SQL condition "the viewer may see this post": PUBLIC posts, plus the
   * viewer's own posts in any state. (The same rule PostService applies to a
   * single post in getVisiblePostEntity.)
   *
   * @param viewerParam Name of the query parameter that holds the viewer's
   *                    email; the caller sets its value.
   */
  private visibleTo(viewerParam: string): string {
    return `(post.status = '${PostStatus.PUBLIC}' OR user.email = :${viewerParam})`;
  }

  /**
   * Counts rows per post in a table that has a "postId" column, with ONE
   * grouped query. Posts without rows are missing from the map (→ 0).
   */
  private async countPerPost(
    entity: typeof CommentEntity | typeof PostLike,
    alias: string,
    postIds: number[],
  ): Promise<Map<number, number>> {
    const rows: { postId: number; count: string }[] = await this.manager
      .getRepository(entity)
      .createQueryBuilder(alias)
      .select(`${alias}."postId"`, 'postId')
      .addSelect('COUNT(*)', 'count')
      .where(`${alias}."postId" IN (:...postIds)`, { postIds })
      .groupBy(`${alias}."postId"`)
      .getRawMany();

    // PostgreSQL returns COUNT(*) as a string (it can exceed JS number range),
    // so both values are converted with Number().
    return new Map(rows.map((row) => [Number(row.postId), Number(row.count)]));
  }

  /**
   * Which of `postIds` the user liked (PostLike) or bookmarked (PostBookmark).
   */
  private async postIdsMarkedBy(
    entity: typeof PostLike | typeof PostBookmark,
    userEmail: string,
    postIds: number[],
  ): Promise<Set<number>> {
    const rows = await this.manager.getRepository(entity).find({
      select: { postId: true },
      where: { userEmail, postId: In(postIds) },
    });
    return new Set(rows.map((row) => row.postId));
  }
}
