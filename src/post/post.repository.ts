import { User } from "src/user/user.entity";
import { EntityRepository, Repository } from "typeorm";
import { PostStatus } from "./post-status.enum";
import { PostEntity } from "./post.entity";
import { CreatePostDto } from "./dto/create-post.dto";
import * as moment from 'moment-timezone';
import { Logger, NotFoundException } from "@nestjs/common";
import { PostInfoDto, PostResponse } from "./dto/post-info.dto";
import { CommentEntity } from "src/comment/comment.entity";

@EntityRepository(PostEntity)
export class PostRepository extends Repository<PostEntity> {

    private logger = new Logger('PostRepository');

    async createPost(createPostDto: CreatePostDto, user: User, imageUrls: string[]) : Promise<PostEntity> {
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
        return {
            id: post.id,
            description: post.description,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            status: post.status,
            imageUrls,
            likes: post.likes,
            bookMarkedUsers: post.bookMarkedUsers,
            comments: [],
            user: {
                email: user.email,
                username: user.username
            }
        } as PostEntity;
    }

    async getPostListByUser(email: string, page: number, limit: number): Promise<PostResponse> {

        const query = this.createQueryBuilder('post')
            .leftJoinAndSelect('post.user', 'user')
            .leftJoinAndSelect('post.comments', 'comment')
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
                'COUNT(comment.id) as commentCount',
            ])
            .leftJoin('comment.post', 'post')
            .groupBy('post.id')
            .addGroupBy('user.email')
            .orderBy('post.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);
    
        const [posts, total] = await query.getManyAndCount();
        
        posts.map(post => ({
            ...post,
            commentCount: post.comments.length,
        }));
        
        this.logger.verbose(`post list length : ${posts.length}`);
        this.logger.verbose(`total : ${total}`);

        return { posts: [], total };
    }

    async getPostList(page: number, limit: number): Promise<PostResponse> {

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
            this.logger.verbose(`post.commentCount: ${post.commentCount}`);
            const postInfo: PostInfoDto = new PostInfoDto();
            postInfo.id = post.id;
            postInfo.description = post.description;
            postInfo.status = post.status;
            postInfo.email = post.user.email;
            postInfo.createdAt = post.createdAt;
            postInfo.updatedAt = post.updatedAt;
            postInfo.imageUrls = post.imageUrls;
            postInfo.likes = post.likes;
            postInfo.bookMarkedUsers = post.bookMarkedUsers;
            postInfo.commentCount = post.commentCount;
            return postInfo;
        });

        this.logger.verbose(`posts: ${JSON.stringify(posts)}`);
        this.logger.verbose(`postList: ${JSON.stringify(postList)}`);
        this.logger.verbose(`commentCount: ${postList[0].commentCount}`);
        this.logger.verbose(`post list length : ${posts.length}`);
        this.logger.verbose(`total : ${total}`);
        
        return { posts: postList, total };
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