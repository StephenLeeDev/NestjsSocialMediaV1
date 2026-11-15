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
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { CommentEntity } from '../comment/comment.entity';
import { PostStatus } from './post-status.enum';
import { PostEntity } from './post.entity';

/** Options for loading one page of a post list. */
export interface PostPageQuery {
  /** 1-based page number (page 1 = newest posts). */
  page: number;
  /** How many posts one page contains. */
  limit: number;
  /** When given, only posts written by this user are returned. */
  authorEmail?: string;
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
   * and comment counts.
   *
   * @returns `[posts on this page, total number of matching posts]`. The total
   *          lets the client know how many pages exist.
   */
  async findPageOfPublicPosts({
    page,
    limit,
    authorEmail,
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
    await this.attachCommentCounts(posts);
    return [posts, total];
  }

  /**
   * Loads a single post (PUBLIC or PRIVATE) with its author and comment count.
   * Returns `null` when no post has this id; deciding what that means (404) is
   * the service's job.
   */
  async findOneWithAuthor(id: number): Promise<PostEntity | null> {
    const post = await this.postWithAuthorQuery()
      .where('post.id = :id', { id })
      .getOne();

    if (post) {
      await this.attachCommentCounts([post]);
    }
    return post;
  }

  /**
   * Adds or removes `email` in the post's list of users who bookmarked it.
   *
   * Called by UserService as part of the bookmark toggle (the user's own
   * bookmark list lives on the User row, this list on the Post row).
   * TODO(user module refactor): move this toggle logic into a service.
   */
  async postBookMark(email: string, postId: number): Promise<string[]> {
    const post = await this.findOneBy({ id: postId });
    if (!post) {
      throw new NotFoundException(`Can't find Post with id ${postId}`);
    }

    // Already bookmarked → remove; otherwise → add.
    post.bookMarkedUsers = post.bookMarkedUsers.includes(email)
      ? post.bookMarkedUsers.filter((bookmarkedBy) => bookmarkedBy !== email)
      : [...post.bookMarkedUsers, email];

    await this.save(post);
    return post.bookMarkedUsers;
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
        'post.likes',
        'post.bookMarkedUsers',
        'user.username',
        'user.email',
        'user.thumbnail',
      ]);
  }

  /**
   * Fills in `commentCount` (comments + replies) on each post, using ONE
   * grouped SQL query for all of them:
   *
   *   SELECT "postId", COUNT(*) FROM comment_entity
   *   WHERE "postId" IN (1, 2, 3) GROUP BY "postId"
   *
   * One query for the whole page is much cheaper than one query per post.
   * Posts without comments do not appear in the result, so they get 0.
   *
   * (TypeORM 0.x did this with `loadRelationCountAndMap`, removed in TypeORM 1.0.)
   */
  private async attachCommentCounts(posts: PostEntity[]): Promise<void> {
    if (posts.length === 0) return;

    const rows: { postId: number; count: string }[] = await this.manager
      .getRepository(CommentEntity)
      .createQueryBuilder('comment')
      .select('comment."postId"', 'postId')
      .addSelect('COUNT(*)', 'count')
      .where('comment."postId" IN (:...ids)', {
        ids: posts.map((post) => post.id),
      })
      .groupBy('comment."postId"')
      .getRawMany();

    // PostgreSQL returns COUNT(*) as a string (it can exceed JS number range),
    // so both values are converted with Number().
    const countByPostId = new Map(
      rows.map((row) => [Number(row.postId), Number(row.count)]),
    );
    for (const post of posts) {
      post.commentCount = countByPostId.get(post.id) ?? 0;
    }
  }
}
