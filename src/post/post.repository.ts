import { User } from '../user/user.entity';
import { DataSource, Repository } from 'typeorm';
import { PostStatus } from './post-status.enum';
import { PostEntity } from './post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { currentSeoulTimestamp } from '../common/utils/date.util';
import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CommentEntity } from '../comment/comment.entity';
import { PostInfoDto, PostResponse } from './dto/post-info.dto';
import { UserInfoDto } from '../user/dto/user-info.dto';
import { PostLikeCountDto } from './dto/post-like-count.dto';
import { UpdatePostDescriptionDto } from './dto/update-post-description.dto';

@Injectable()
export class PostRepository extends Repository<PostEntity> {
  private logger = new Logger('PostRepository');

  constructor(dataSource: DataSource) {
    super(PostEntity, dataSource.createEntityManager());
  }

  /**
   * Sets `commentCount` (comments + replies) on each post with a single grouped query.
   * Replaces `loadRelationCountAndMap`, which was removed in TypeORM 1.0.
   */
  async attachCommentCounts(posts: PostEntity[]): Promise<void> {
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

    const countByPostId = new Map(
      rows.map((row) => [Number(row.postId), Number(row.count)]),
    );
    for (const post of posts) {
      post.commentCount = countByPostId.get(post.id) ?? 0;
    }
  }

  async createPost(
    createPostDto: CreatePostDto,
    user: User,
    imageUrls: string[],
  ): Promise<PostInfoDto> {
    const { description } = createPostDto;

    const createdAt = currentSeoulTimestamp(); // Seoul local time, see common/utils/date.util.ts

    const post = this.create({
      description,
      status: PostStatus.PUBLIC,
      user,
      createdAt,
      updatedAt: createdAt,
      imageUrls,
      likes: [],
      bookMarkedUsers: [],
    });

    await this.save(post);

    this.logger.verbose(`${user.email}'s new post has created.`);

    const postInfo: PostInfoDto = new PostInfoDto();
    postInfo.id = post.id;
    postInfo.description = post.description;
    postInfo.status = post.status;
    postInfo.user = new UserInfoDto();
    postInfo.user.email = post.user.email;
    postInfo.user.username = post.user.username;
    postInfo.user.thumbnail = post.user.thumbnail;
    postInfo.createdAt = post.createdAt;
    postInfo.updatedAt = post.updatedAt;
    postInfo.imageUrls = post.imageUrls;
    postInfo.isLiked = false;
    postInfo.isBookmarked = false;
    postInfo.commentCount = 0;

    return postInfo;
  }

  async getPostListByUser(
    email: string,
    page: number,
    limit: number,
  ): Promise<PostResponse> {
    const query = this.createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .where('user.email = :email', { email })
      .andWhere('post.status = :status', { status: PostStatus.PUBLIC })
      .select([
        'post.id',
        'post.description',
        'post.status',
        'post.createdAt',
        'post.imageUrls',
        'post.likes',
        'post.bookMarkedUsers',
        'user.username',
        'user.email',
        'user.thumbnail',
      ])
      .orderBy('post.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [posts, total] = await query.getManyAndCount();
    await this.attachCommentCounts(posts);

    const postList: PostInfoDto[] = posts.map((post: PostEntity) => {
      const postInfo: PostInfoDto = new PostInfoDto();
      postInfo.id = post.id;
      postInfo.description = post.description;
      postInfo.status = post.status;
      postInfo.user = new UserInfoDto();
      postInfo.user.email = post.user.email;
      postInfo.user.username = post.user.username;
      postInfo.user.thumbnail = post.user.thumbnail;
      postInfo.createdAt = post.createdAt;
      postInfo.updatedAt = post.updatedAt;
      postInfo.imageUrls = post.imageUrls;
      postInfo.likeCount = post.likes.length;
      postInfo.isLiked = post.likes.includes(email);
      postInfo.isBookmarked = post.bookMarkedUsers.includes(email);
      postInfo.commentCount = post.commentCount;
      return postInfo;
    });

    return { posts: postList, total };
  }

  async getPostList(
    email: string,
    page: number,
    limit: number,
  ): Promise<PostResponse> {
    const query = this.createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .where('post.status = :status', { status: PostStatus.PUBLIC })
      .select([
        'post.id',
        'post.description',
        'post.status',
        'post.createdAt',
        'post.imageUrls',
        'post.likes',
        'post.bookMarkedUsers',
        'user.username',
        'user.email',
        'user.thumbnail',
      ])
      .orderBy('post.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [posts, total] = await query.getManyAndCount();
    await this.attachCommentCounts(posts);

    const postList: PostInfoDto[] = posts.map((post: PostEntity) => {
      const postInfo: PostInfoDto = new PostInfoDto();
      postInfo.id = post.id;
      postInfo.description = post.description;
      postInfo.status = post.status;
      postInfo.user = new UserInfoDto();
      postInfo.user.email = post.user.email;
      postInfo.user.username = post.user.username;
      postInfo.user.thumbnail = post.user.thumbnail;
      postInfo.createdAt = post.createdAt;
      postInfo.updatedAt = post.updatedAt;
      postInfo.imageUrls = post.imageUrls;
      postInfo.likeCount = post.likes.length;
      postInfo.isLiked = post.likes.includes(email);
      postInfo.isBookmarked = post.bookMarkedUsers.includes(email);
      postInfo.commentCount = post.commentCount;
      return postInfo;
    });

    return { posts: postList, total };
  }

  async updatePostDescription(
    email: string,
    updatePostDescriptionDto: UpdatePostDescriptionDto,
  ): Promise<PostInfoDto> {
    const post = await this.createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .where('post.id = :id', { id: updatePostDescriptionDto.postId })
      .select([
        'post.id',
        'post.description',
        'post.status',
        'post.createdAt',
        'post.imageUrls',
        'post.likes',
        'post.bookMarkedUsers',
        'user.username',
        'user.email',
        'user.thumbnail',
      ])
      .getOne();

    if (post) {
      await this.attachCommentCounts([post]);
      /// Does not have the right to update the post
      if (post.user.email != email) {
        throw new UnauthorizedException();
      }
      /// Update the description
      post.description = updatePostDescriptionDto.description;
      await this.save(post);

      /// Return result
      const postInfo: PostInfoDto = new PostInfoDto();
      postInfo.id = post.id;
      postInfo.description = post.description;
      postInfo.status = post.status;
      postInfo.user = new UserInfoDto();
      postInfo.user.email = post.user.email;
      postInfo.user.username = post.user.username;
      postInfo.user.thumbnail = post.user.thumbnail;
      postInfo.createdAt = post.createdAt;
      postInfo.updatedAt = post.updatedAt;
      postInfo.imageUrls = post.imageUrls;
      postInfo.likeCount = post.likes.length;
      postInfo.isLiked = post.likes.includes(email);
      postInfo.isBookmarked = post.bookMarkedUsers.includes(email);
      postInfo.commentCount = post.commentCount;
      return postInfo;
    } else {
      throw new NotFoundException(
        `Can't find Post with id ${updatePostDescriptionDto.postId}`,
      );
    }
  }

  async likeUnlikePost(
    postId: number,
    email: string,
  ): Promise<PostLikeCountDto> {
    const post = await this.findOneBy({ id: postId });
    if (post) {
      if (!post.likes.includes(email)) {
        post.likes.push(email);
        this.logger.verbose(`The user ${email} likes Post ${postId}`);
      } else {
        post.likes = post.likes.filter((like) => like !== email);
        this.logger.verbose(`The user ${email} unlikes Post ${postId}`);
      }
      await this.save(post);
      const postLikeCountDto = new PostLikeCountDto();
      postLikeCountDto.likeCount = post.likes.length;
      return postLikeCountDto;
    } else {
      throw new NotFoundException(`Can't find Post with id ${postId}`);
    }
  }

  async postBookMark(email: string, postId: number): Promise<string[]> {
    const post = await this.findOneBy({ id: postId });
    if (post) {
      // If it hadn't been bookmarked yet, proceed with bookmarking.
      if (!post.bookMarkedUsers.includes(email)) {
        post.bookMarkedUsers.push(email);
      }
      // If it was previously bookmarked, cancel the bookmark
      else {
        post.bookMarkedUsers = post.bookMarkedUsers.filter(
          (like) => like !== email,
        );
      }
      await this.save(post);
      return post.bookMarkedUsers;
    } else {
      throw new NotFoundException(`Can't find Post with id ${postId}`);
    }
  }
}
