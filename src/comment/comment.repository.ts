/**
 * ============================================================================
 *  CommentRepository: database access for comments and replies
 * ============================================================================
 *
 * Responsibility: talking to the database, and nothing else. Business rules
 * (who may edit, what a valid reply is, visibility) live in CommentService;
 * the response shape lives in comment.mapper.ts.
 *
 * Comments and replies share one table ("comment_entity"):
 *   - type = COMMENT, parentCommentId = NULL   → written on the post
 *   - type = REPLY,   parentCommentId = <id>   → written on that comment
 */
import { Injectable } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { CommentType } from './comment-type.enum';
import { CommentEntity } from './comment.entity';

/** Options for loading one page of comments or replies. */
export interface CommentPageQuery {
  /** The post the comments belong to. */
  postId: number;
  /** 1-based page number (page 1 = newest). */
  page: number;
  /** How many comments one page contains. */
  limit: number;
}

@Injectable()
export class CommentRepository extends Repository<CommentEntity> {
  constructor(dataSource: DataSource) {
    super(CommentEntity, dataSource.createEntityManager());
  }

  // ==========================================================================
  //  Queries used by CommentService
  // ==========================================================================

  /**
   * One page of the TOP-LEVEL comments of a post, newest first, each with the
   * number of replies it has.
   *
   * @returns `[comments on this page, total number of top-level comments]`
   */
  async findCommentsPage({
    postId,
    page,
    limit,
  }: CommentPageQuery): Promise<[CommentEntity[], number]> {
    const [comments, total] = await this.paginate(
      this.commentWithAuthorQuery()
        .where('post.id = :postId', { postId })
        .andWhere('comment.type = :type', { type: CommentType.Comment }),
      page,
      limit,
    ).getManyAndCount();

    await this.attachChildrenCounts(comments);
    return [comments, total];
  }

  /**
   * One page of the REPLIES to one comment, newest first.
   * (Replies cannot have replies themselves, so no counts are loaded; the
   * mapper reports 0.)
   *
   * @returns `[replies on this page, total number of replies]`
   */
  async findRepliesPage(
    parentCommentId: number,
    { postId, page, limit }: CommentPageQuery,
  ): Promise<[CommentEntity[], number]> {
    return this.paginate(
      this.commentWithAuthorQuery()
        .where('post.id = :postId', { postId })
        .andWhere('comment.parentCommentId = :parentCommentId', {
          parentCommentId,
        })
        .andWhere('comment.type = :type', { type: CommentType.Reply }),
      page,
      limit,
    ).getManyAndCount();
  }

  /**
   * A single comment with its author, its post id and its number of replies.
   * Returns `null` when no comment has this id.
   */
  async findOneWithAuthor(id: number): Promise<CommentEntity | null> {
    const comment = await this.commentWithAuthorQuery()
      .where('comment.id = :id', { id })
      .getOne();

    if (comment) {
      await this.attachChildrenCounts([comment]);
    }
    return comment;
  }

  // ==========================================================================
  //  Internal helpers
  // ==========================================================================

  /**
   * The common starting point for every comment query: the comment joined
   * with its author (public columns only) and with the ID of its post.
   *
   * Only `post.id` is selected from the post. The old queries loaded the
   * whole post row (including its arrays of likes and bookmarks) for every
   * comment, although only the id was used.
   */
  private commentWithAuthorQuery(): SelectQueryBuilder<CommentEntity> {
    return this.createQueryBuilder('comment')
      .leftJoin('comment.user', 'user')
      .leftJoin('comment.post', 'post')
      .select([
        'comment',
        'user.email',
        'user.username',
        'user.thumbnail',
        'post.id',
      ]);
  }

  /** Newest first, then cut out the requested page. */
  private paginate(
    query: SelectQueryBuilder<CommentEntity>,
    page: number,
    limit: number,
  ): SelectQueryBuilder<CommentEntity> {
    return query
      .orderBy('comment.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
  }

  /**
   * Fills in `childrenCount` (number of replies) on each comment with ONE
   * grouped query for all of them:
   *
   *   SELECT "parentCommentId", COUNT(*) FROM comment_entity
   *   WHERE "parentCommentId" IN (1, 2, 3) GROUP BY "parentCommentId"
   *
   * Comments without replies do not appear in the result, so they get 0.
   * (TypeORM 0.x did this with `loadRelationCountAndMap`, removed in 1.0.)
   */
  private async attachChildrenCounts(comments: CommentEntity[]): Promise<void> {
    if (comments.length === 0) return;

    const rows: { parentCommentId: number; count: string }[] =
      await this.createQueryBuilder('reply')
        .select('reply.parentCommentId', 'parentCommentId')
        .addSelect('COUNT(*)', 'count')
        .where('reply.parentCommentId IN (:...ids)', {
          ids: comments.map((comment) => comment.id),
        })
        .groupBy('reply.parentCommentId')
        .getRawMany();

    // PostgreSQL returns COUNT(*) as a string, hence Number().
    const countByParentId = new Map(
      rows.map((row) => [Number(row.parentCommentId), Number(row.count)]),
    );
    for (const comment of comments) {
      comment.childrenCount = countByParentId.get(comment.id) ?? 0;
    }
  }
}
