import { User } from "src/user/user.entity";
import { EntityRepository, Repository } from "typeorm";
import { PostStatus } from "./post-status.enum";
import { PostEntity } from "./post.entity";
import { CreatePostDto } from "./dto/create-post.dto";
import * as moment from 'moment-timezone';
import { Logger, NotFoundException } from "@nestjs/common";
import { PostInfoDto, PostResponse } from "./dto/post-info.dto";
import { UserInfoDto } from "src/user/dto/user-info.dto";
import { PostLikeCountDto } from "./dto/post-like-count.dto";

@EntityRepository(PostEntity)
export class PostRepository extends Repository<PostEntity> {

    private logger = new Logger('PostRepository');

    async createPost(createPostDto: CreatePostDto, user: User, imageUrls: string[]) : Promise<PostInfoDto> {
        const { description } = createPostDto;

        const createdAt = moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss.SSS'); // You can set your time zone here
        
        const post = this.create({
            description,
            status: PostStatus.PUBLIC,
            user,
            createdAt,
            updatedAt: createdAt,
            imageUrls,
            likes: [],
            bookMarkedUsers: []
        })

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
        postInfo.commentCount = post.commentCount;

        return postInfo;
    }

    async getPostListByUser(email: string, page: number, limit: number): Promise<PostResponse> {
        const query = this.createQueryBuilder('post')
            .leftJoinAndSelect('post.user', 'user')
            .leftJoin('post.comments', 'comment_entity')
            .loadRelationCountAndMap('post.commentCount', 'post.comments')
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
                'COUNT(comment_entity.id) as commentCount',
            ])
            .groupBy('post.id')
            .addGroupBy('user.email')
            .orderBy('post.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);
        
        const [posts, total] = await query.getManyAndCount();
        
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

    async getPostList(email: string, page: number, limit: number): Promise<PostResponse> {

        const query = this.createQueryBuilder('post')
            .leftJoinAndSelect('post.user', 'user')
            .leftJoin('post.comments', 'comment_entity')
            .loadRelationCountAndMap('post.commentCount', 'post.comments')
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
                'COUNT(comment_entity.id) as commentCount',
            ])
            .groupBy('post.id')
            .addGroupBy('user.email')
            .orderBy('post.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);
        
        const [posts, total] = await query.getManyAndCount();
        
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

    async likeUnlikePost(
        postId: number,
        email: string,
    ): Promise<PostLikeCountDto> {
        const post = await this.findOne(postId);
        if (post) {
            if (!post.likes.includes(email)) {
                post.likes.push(email);
                this.logger.verbose(`The user ${email} likes Post ${postId}`);
            } else {
                post.likes = post.likes.filter((like) => like !== email);
                this.logger.verbose(`The user ${email} unlikes Post ${postId}`);
            }
            await this.save(post);
            const postLikeCountDto = new PostLikeCountDto;
            postLikeCountDto.likeCount = post.likes.length;
            return postLikeCountDto;
        } else {
            throw new NotFoundException(`Can't find Post with id ${postId}`);
        }
    }

    async postBookMark(
        email: string,
        postId: number,
    ): Promise<string[]> {
        const post = await this.findOne(postId);
        if (post) {
            // If it hadn't been bookmarked yet, proceed with bookmarking.
            if (!post.bookMarkedUsers.includes(email)) {
                post.bookMarkedUsers.push(email);
            }
            // If it was previously bookmarked, cancel the bookmark
            else {
                post.bookMarkedUsers = post.bookMarkedUsers.filter((like) => like !== email);
            }
            await this.save(post);
            return post.bookMarkedUsers;
        } else {
            throw new NotFoundException(`Can't find Post with id ${postId}`);
        }
    }

}