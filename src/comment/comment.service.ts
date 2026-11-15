/**
 * ============================================================================
 *  CommentService: the business rules for comments and replies
 * ============================================================================
 *
 * Layering (same pattern as the post module):
 *
 *   CommentController  → HTTP only
 *        │
 *   CommentService     → rules (THIS FILE)
 *        │                 - the post must exist AND be visible to the viewer
 *        │                   (delegated to PostService, the single owner of
 *        │                   that rule)
 *        │                 - a reply's parent must be a top-level comment on
 *        │                   the same post
 *        │                 - only the author may edit or delete a comment
 *        │
 *   CommentRepository  → database queries only
 *   comment.mapper.ts  → entity → response DTO
 *
 * "Viewer" = the signed-in user making the request.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthRepository } from '../auth/auth.repository';
import { currentSeoulTimestamp } from '../common/utils/date.util';
import { randomSentence } from '../common/utils/random.util';
import { PostEntity } from '../post/post.entity';
import { PostService } from '../post/post.service';
import { User } from '../user/user.entity';
import { UserRepository } from '../user/user.repository';
import { CommentType } from './comment-type.enum';
import { CommentEntity } from './comment.entity';
import { toCommentInfoDto } from './comment.mapper';
import { CommentRepository } from './comment.repository';
import { CommentInfoDto, CommentInfoListDto } from './dto/comment-info.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateDummyCommentDto } from './dto/create-dummy-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

/** How many comments POST /comment/test/dummy creates. */
const DUMMY_COMMENT_COUNT = 10;

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    private readonly commentRepository: CommentRepository,
    // Owns the post visibility rule (PRIVATE posts are hidden from others).
    private readonly postService: PostService,
    // The two repositories below are only needed by createDummyComments.
    private readonly userRepository: UserRepository,
    private readonly authRepository: AuthRepository,
  ) {}

  // ==========================================================================
  //  Create
  // ==========================================================================

  /**
   * Writes a comment on a post, or a reply when `parentCommentId` is given.
   *
   * @throws NotFoundException   (404) post missing / hidden, or parent missing.
   * @throws BadRequestException (400) parent is on another post or is a reply.
   */
  async createComment(
    dto: CreateCommentDto,
    author: User,
  ): Promise<CommentInfoDto> {
    const post = await this.postService.getVisiblePostEntity(
      dto.postId,
      author.email,
    );
    const parent = await this.resolveParent(post, dto.parentCommentId);

    // `dto.parentCommentAuthor` is deliberately NOT used: the server takes the
    // real author of the parent comment instead of trusting the client.
    return this.saveNewComment(author, post, parent, dto.content);
  }

  // ==========================================================================
  //  Read
  // ==========================================================================

  /**
   * One page of the top-level comments of a post.
   *
   * @throws NotFoundException (404) when the post is missing or hidden from
   *         the viewer. (Previously an unknown post returned an empty list.)
   */
  async getComments(
    postId: number,
    viewerEmail: string,
    page: number,
    limit: number,
  ): Promise<CommentInfoListDto> {
    await this.postService.getVisiblePostEntity(postId, viewerEmail);

    const [comments, total] = await this.commentRepository.findCommentsPage({
      postId,
      page,
      limit,
    });
    return { comments: comments.map(toCommentInfoDto), total };
  }

  /**
   * One page of the replies to one comment.
   *
   * @throws NotFoundException (404) when the post is missing or hidden.
   */
  async getReplies(
    parentCommentId: number,
    postId: number,
    viewerEmail: string,
    page: number,
    limit: number,
  ): Promise<CommentInfoListDto> {
    await this.postService.getVisiblePostEntity(postId, viewerEmail);

    const [replies, total] = await this.commentRepository.findRepliesPage(
      parentCommentId,
      { postId, page, limit },
    );
    return { comments: replies.map(toCommentInfoDto), total };
  }

  // ==========================================================================
  //  Update / delete
  // ==========================================================================

  /**
   * Changes the text of the viewer's own comment.
   *
   * @throws NotFoundException     (404) when the comment does not exist.
   *         (Previously this answered 200 with an empty body.)
   * @throws UnauthorizedException (401) when the viewer is not the author.
   *         (401 kept for compatibility; 403 would be more precise.)
   */
  async updateComment(
    { id, content }: UpdateCommentDto,
    viewer: User,
  ): Promise<CommentInfoDto> {
    const comment = await this.commentRepository.findOneWithAuthor(id);
    if (!comment) {
      throw this.commentNotFound(id);
    }
    if (comment.user.email !== viewer.email) {
      throw new UnauthorizedException(
        'You do not have permission to update this comment',
      );
    }

    comment.content = content;
    comment.updatedAt = this.now();
    await this.commentRepository.save(comment);

    return toCommentInfoDto(comment);
  }

  /**
   * Deletes the viewer's own comment. Its replies are deleted with it by the
   * database (`onDelete: 'CASCADE'` in CommentEntity).
   *
   * The DELETE statement only matches comments owned by `author`, so trying
   * to delete someone else's comment deletes nothing and answers 404.
   *
   * @throws NotFoundException (404) when nothing was deleted.
   */
  async deleteComment(id: number, author: User): Promise<void> {
    const result = await this.commentRepository.delete({ id, user: author });

    if (result.affected === 0) {
      throw this.commentNotFound(id);
    }
  }

  // ==========================================================================
  //  Development helper
  // ==========================================================================

  /**
   * Creates DUMMY_COMMENT_COUNT random comments on a post (or replies under
   * `parentCommentId`), written by up to 10 existing users. Dummy users are
   * created first when there are fewer than that.
   *
   * The same rules as for real comments apply, and the comments are saved
   * one after another BEFORE responding. (They used to be saved in the
   * background with timers; an unknown post then crashed after the 201.)
   *
   * @param viewerEmail The signed-in user calling the endpoint; the post must
   *                    be visible to them.
   */
  async createDummyComments(
    dto: CreateDummyCommentDto,
    viewerEmail: string,
  ): Promise<void> {
    const post = await this.postService.getVisiblePostEntity(
      dto.postId,
      viewerEmail,
    );
    const parent = await this.resolveParent(post, dto.parentCommentId);

    // TODO(auth/user module refactor): share "pick dummy authors" with
    // PostService instead of repeating it here.
    let authors = await this.userRepository.find({ take: DUMMY_COMMENT_COUNT });
    if (authors.length < DUMMY_COMMENT_COUNT) {
      await this.authRepository.createDummyUsers();
      authors = await this.userRepository.find({ take: DUMMY_COMMENT_COUNT });
    }

    for (const author of authors) {
      await this.saveNewComment(author, post, parent, randomSentence(3, 12));
    }
  }

  // ==========================================================================
  //  Private helpers
  // ==========================================================================

  /**
   * Turns the requested `parentCommentId` into the parent comment, after
   * checking that a reply to it is allowed.
   *
   * @returns `null` for a top-level comment (no parent requested).
   * @throws NotFoundException   (404) when the parent does not exist.
   * @throws BadRequestException (400) when the parent is on another post, or
   *         is itself a reply (replies are one level deep).
   */
  private async resolveParent(
    post: PostEntity,
    parentCommentId: number | null | undefined,
  ): Promise<CommentEntity | null> {
    // `== null` is true for both null and undefined.
    if (parentCommentId == null) {
      return null;
    }

    const parent =
      await this.commentRepository.findOneWithAuthor(parentCommentId);
    if (!parent) {
      throw this.commentNotFound(parentCommentId);
    }
    if (parent.post.id !== post.id) {
      throw new BadRequestException(
        'The parent comment belongs to a different post',
      );
    }
    if (parent.type !== CommentType.Comment) {
      throw new BadRequestException('Replies to replies are not supported');
    }
    return parent;
  }

  /**
   * Saves a new comment (or a reply, when `parent` is given) and returns it as
   * an API response. All validation must have happened before.
   */
  private async saveNewComment(
    author: User,
    post: PostEntity,
    parent: CommentEntity | null,
    content: string,
  ): Promise<CommentInfoDto> {
    // createdAt and updatedAt start out identical.
    const now = this.now();
    const comment = this.commentRepository.create({
      content,
      type: parent ? CommentType.Reply : CommentType.Comment,
      parentCommentId: parent?.id ?? null,
      // Taken from the parent itself, never from the request.
      parentCommentAuthor: parent?.user.email ?? null,
      post,
      user: author,
      createdAt: now,
      updatedAt: now,
    });
    await this.commentRepository.save(comment);
    this.logger.verbose(`${author.email} wrote comment ${comment.id}`);

    // A brand-new comment has no replies; the mapper reports 0.
    return toCommentInfoDto(comment);
  }

  /** The current time as stored in comment timestamps (Seoul local time). */
  private now(): Date {
    // See common/utils/date.util.ts for why timestamps are stored this way.
    return new Date(currentSeoulTimestamp());
  }

  /** The 404 error used for every "comment not found" case. */
  private commentNotFound(id: number): NotFoundException {
    return new NotFoundException(`Can't find comment with id ${id}`);
  }
}
