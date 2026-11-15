/**
 * ============================================================================
 *  PostService: the business rules for posts
 * ============================================================================
 *
 * Layering in the post module:
 *
 *   PostController  → HTTP only: routes, parameter parsing, file upload
 *        │
 *   PostService     → business rules (THIS FILE)
 *        │              - does the post exist? (404)
 *        │              - is the caller allowed to do this? (401)
 *        │              - who can see PRIVATE posts
 *        │              - like / unlike, PUBLIC / PRIVATE toggles
 *        │
 *   PostRepository  → database queries only
 *   post.mapper.ts  → entity → response DTO
 *
 * Keeping the rules here (instead of in the repository, where most of them
 * used to be) means they can be unit tested with a fake repository, without a
 * database. See post.service.spec.ts.
 *
 * About "viewer": many methods take the email of the signed-in user making the
 * request. It is used for permission checks and for the personal flags in the
 * response (`isLiked`, `isBookmarked`).
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
import { User } from '../user/user.entity';
import { UserRepository } from '../user/user.repository';
import { CreatePostDto } from './dto/create-post.dto';
import { PostInfoDto, PostResponse } from './dto/post-info.dto';
import { PostLikeCountDto } from './dto/post-like-count.dto';
import { UpdatePostDescriptionDto } from './dto/update-post-description.dto';
import {
  randomDummyImageSets,
  randomSentence,
  shuffle,
} from './dummy/dummy-post-data';
import { PostStatus } from './post-status.enum';
import { PostEntity } from './post.entity';
import { toPostInfoDto } from './post.mapper';
import { PostRepository } from './post.repository';

/** How many posts POST /post/test/dummy creates. */
const DUMMY_POST_COUNT = 10;

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(
    private readonly postRepository: PostRepository,
    // The two repositories below are only needed by createDummyPosts.
    private readonly userRepository: UserRepository,
    private readonly authRepository: AuthRepository,
  ) {}

  // ==========================================================================
  //  Create
  // ==========================================================================

  /**
   * Creates a new PUBLIC post.
   *
   * @param author    The signed-in user writing the post.
   * @param imageUrls Public URLs of the images Multer has already saved.
   *                  At least one is required: posts are picture posts.
   * @throws BadRequestException (400) when no image was uploaded.
   */
  async createPost(
    createPostDto: CreatePostDto,
    author: User,
    imageUrls: string[],
  ): Promise<PostInfoDto> {
    if (imageUrls.length === 0) {
      throw new BadRequestException('At least one image is required');
    }

    // createdAt and updatedAt start out identical.
    const now = currentSeoulTimestamp(); // Seoul local time, see common/utils/date.util.ts
    const post = this.postRepository.create({
      description: createPostDto.description,
      status: PostStatus.PUBLIC,
      user: author,
      createdAt: now,
      updatedAt: now,
      imageUrls,
      // Nobody has liked or bookmarked a brand-new post yet.
      likes: [],
      bookMarkedUsers: [],
    });
    await this.postRepository.save(post);
    this.logger.verbose(`${author.email} created post ${post.id}`);

    // A new post has no comments; the mapper treats the missing count as 0.
    return toPostInfoDto(post, author.email);
  }

  // ==========================================================================
  //  Read
  // ==========================================================================

  /** One page of the global feed: everyone's PUBLIC posts, newest first. */
  async getFeed(
    viewerEmail: string,
    page: number,
    limit: number,
  ): Promise<PostResponse> {
    const [posts, total] = await this.postRepository.findPageOfPublicPosts({
      page,
      limit,
    });
    return {
      posts: posts.map((post) => toPostInfoDto(post, viewerEmail)),
      total,
    };
  }

  /**
   * One page of a single user's PUBLIC posts, newest first.
   *
   * @param authorEmail Whose posts to list.
   * @param viewerEmail Who is looking. `isLiked` / `isBookmarked` describe THIS
   *                    user. (They used to be computed for the author by
   *                    mistake, so they were wrong on other people's profiles.)
   */
  async getPostsByAuthor(
    authorEmail: string,
    viewerEmail: string,
    page: number,
    limit: number,
  ): Promise<PostResponse> {
    const [posts, total] = await this.postRepository.findPageOfPublicPosts({
      page,
      limit,
      authorEmail,
    });
    return {
      posts: posts.map((post) => toPostInfoDto(post, viewerEmail)),
      total,
    };
  }

  /**
   * A single post.
   *
   * PRIVATE posts are visible to their author only. For everybody else they
   * behave as if they did not exist (404), so their existence is not revealed.
   *
   * @throws NotFoundException (404) when the post does not exist or is hidden.
   */
  async getPost(id: number, viewerEmail: string): Promise<PostInfoDto> {
    const post = await this.findPostOrFail(id);

    const isAuthor = post.user.email === viewerEmail;
    if (post.status === PostStatus.PRIVATE && !isAuthor) {
      throw this.postNotFound(id);
    }

    return toPostInfoDto(post, viewerEmail);
  }

  // ==========================================================================
  //  Update
  // ==========================================================================

  /**
   * Changes the description of the viewer's own post.
   *
   * @throws NotFoundException (404) when the post does not exist.
   * @throws UnauthorizedException (401) when the viewer is not the author.
   */
  async updateDescription(
    viewerEmail: string,
    { postId, description }: UpdatePostDescriptionDto,
  ): Promise<PostInfoDto> {
    const post = await this.findPostOrFail(postId);
    this.assertIsAuthor(post, viewerEmail);

    post.description = description;
    await this.postRepository.save(post);

    return toPostInfoDto(post, viewerEmail);
  }

  /**
   * Likes the post, or removes the like if the viewer already liked it.
   *
   * @returns The new total number of likes.
   * @throws NotFoundException (404) when the post does not exist.
   */
  async toggleLike(
    postId: number,
    viewerEmail: string,
  ): Promise<PostLikeCountDto> {
    const post = await this.postRepository.findOneBy({ id: postId });
    if (!post) {
      throw this.postNotFound(postId);
    }

    // `likes` holds the emails of everyone who liked the post.
    const alreadyLiked = post.likes.includes(viewerEmail);
    post.likes = alreadyLiked
      ? post.likes.filter((likedBy) => likedBy !== viewerEmail)
      : [...post.likes, viewerEmail];
    await this.postRepository.save(post);

    this.logger.verbose(
      `${viewerEmail} ${alreadyLiked ? 'unliked' : 'liked'} post ${postId}`,
    );

    const result = new PostLikeCountDto();
    result.likeCount = post.likes.length;
    return result;
  }

  /**
   * Switches the viewer's own post between PUBLIC and PRIVATE.
   *
   * (Previously there was no author check, so ANY signed-in user could hide
   * anyone's post. The old code also passed the response DTO to `save()`
   * instead of the entity.)
   *
   * @throws NotFoundException (404) when the post does not exist.
   * @throws UnauthorizedException (401) when the viewer is not the author.
   */
  async togglePostStatus(id: number, viewerEmail: string): Promise<void> {
    const post = await this.findPostOrFail(id);
    this.assertIsAuthor(post, viewerEmail);

    post.status =
      post.status === PostStatus.PUBLIC
        ? PostStatus.PRIVATE
        : PostStatus.PUBLIC;
    await this.postRepository.save(post);
  }

  // ==========================================================================
  //  Delete
  // ==========================================================================

  /**
   * Deletes the viewer's own post. Its comments and replies are deleted with
   * it by the database (`onDelete: 'CASCADE'` in CommentEntity).
   *
   * The DELETE statement itself only matches posts owned by `author`, so
   * trying to delete someone else's post deletes nothing and answers 404,
   * exactly like a post that does not exist.
   *
   * @throws NotFoundException (404) when nothing was deleted.
   */
  async deletePost(id: number, author: User): Promise<void> {
    const result = await this.postRepository.delete({ id, user: author });

    if (result.affected === 0) {
      throw this.postNotFound(id);
    }
  }

  // ==========================================================================
  //  Development helper
  // ==========================================================================

  /**
   * Creates DUMMY_POST_COUNT sample posts with random text and bundled images.
   *
   * @param email When given (and the user exists), all posts are written by
   *              that user. Otherwise they are spread over random dummy users,
   *              which are created first if fewer than needed exist.
   */
  async createDummyPosts(email?: string): Promise<void> {
    // Only look the user up when an email was actually given: TypeORM 1.x
    // throws on `undefined` inside a where condition.
    const requestedAuthor = email
      ? await this.userRepository.findOneBy({ email })
      : null;

    const authors = requestedAuthor
      ? Array<User>(DUMMY_POST_COUNT).fill(requestedAuthor)
      : await this.pickDummyAuthors();

    const imageSets = randomDummyImageSets(DUMMY_POST_COUNT);

    // Posts are created one after another (not all at once), so each one gets
    // a slightly later createdAt and the feed shows them in a stable order.
    // (This used to fire timers in the background and answer before the posts
    // existed.)
    for (const [index, author] of authors.entries()) {
      const dto = new CreatePostDto();
      dto.description = randomSentence();
      await this.createPost(dto, author, imageSets[index]);
    }
  }

  // ==========================================================================
  //  Private helpers
  // ==========================================================================

  /** Loads the post with its author, or throws 404. */
  private async findPostOrFail(id: number): Promise<PostEntity> {
    const post = await this.postRepository.findOneWithAuthor(id);
    if (!post) {
      throw this.postNotFound(id);
    }
    return post;
  }

  /**
   * Throws unless `viewerEmail` wrote the post.
   *
   * 401 Unauthorized is kept for compatibility with existing clients.
   * Strictly speaking 403 Forbidden ("signed in, but not allowed") would be
   * more precise; changing it is an API change for a later step.
   */
  private assertIsAuthor(post: PostEntity, viewerEmail: string): void {
    if (post.user.email !== viewerEmail) {
      throw new UnauthorizedException('Only the author can change this post');
    }
  }

  /** The 404 error used for every "post not found / not visible" case. */
  private postNotFound(id: number): NotFoundException {
    return new NotFoundException(`Can't find Post with id ${id}`);
  }

  /**
   * Picks DUMMY_POST_COUNT authors from the existing users in random order,
   * creating the dummy users first when there are not enough.
   */
  private async pickDummyAuthors(): Promise<User[]> {
    let users = await this.userRepository.find({ take: DUMMY_POST_COUNT });

    if (users.length < DUMMY_POST_COUNT) {
      await this.authRepository.createDummyUsers();
      users = await this.userRepository.find({ take: DUMMY_POST_COUNT });
    }

    // If there are still fewer users than posts, reuse users from the start
    // of the list to fill up, then shuffle.
    const filled = [
      ...users,
      ...users.slice(0, DUMMY_POST_COUNT - users.length),
    ];
    return shuffle(filled);
  }
}
