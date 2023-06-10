import { User } from "src/user/user.entity";
import { EntityRepository, Repository } from "typeorm";
import { PostStatus } from "./post-status.enum";
import { PostEntity, PostResponse } from "./post.entity";
import { CreatePostDto } from "./dto/create-post.dto";
import * as moment from 'moment-timezone';
import { Logger, NotFoundException } from "@nestjs/common";

@EntityRepository(PostEntity)
export class PostRepository extends Repository<PostEntity> {

    private logger = new Logger('PostRepository');

    async createPost(createPostDto: CreatePostDto, user: User, imageUrls: string[]) : Promise<PostEntity> {
        const { description } = createPostDto;

        const createdAt = moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss');
        
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
        return {
            id: post.id,
            description: post.description,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            status: post.status,
            imageUrls,
            likes: post.likes,
            user: {
                email: user.email,
                username: user.username
            }
        } as PostEntity;
    }

    async getPostListByUser(email: string, page: number, limit: number): Promise<PostResponse> {

        const query = this.createQueryBuilder('post');
        query
            .where('post.user.email = :email', { email })
            .andWhere('post.status = :status', { status: PostStatus.PUBLIC })
            .leftJoinAndSelect('post.user', 'user')
            .select(['post.id', 'post.description', 'post.status', 'post.createdAt', 'post.imageUrls', 'user.username', 'user.email', 'user.thumbnail'])
            .orderBy('post.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        const [posts, total] = await query.getManyAndCount();

        this.logger.verbose(`post list length : ${posts.length}`);
        this.logger.verbose(`total : ${total}`);

        return { posts, total };
    }

    async getPostList(page: number, limit: number): Promise<PostResponse> {

        const query = this.createQueryBuilder('post');
        query
            .where('post.status = :status', { status: PostStatus.PUBLIC })
            .leftJoinAndSelect('post.user', 'user')
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
                'user.thumbnail'
            ])
            .orderBy('post.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        const [posts, total] = await query.getManyAndCount();

        this.logger.verbose(`post list length : ${posts.length}`);
        this.logger.verbose(`total : ${total}`);

        return { posts, total };
    }

    async likeUnlikePost(
        postId: number,
        email: string,
    ): Promise<string[]> {
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
            return post.likes;
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