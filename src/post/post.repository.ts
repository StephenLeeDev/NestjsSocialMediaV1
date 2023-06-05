import { User } from "src/user/user.entity";
import { EntityRepository, Repository } from "typeorm";
import { PostStatus } from "./post-status.enum";
import { PostEntity, PostResponse } from "./post.entity";
import { CreatePostDto } from "./dto/create-post.dto";
import * as moment from 'moment-timezone';
import { Logger } from "@nestjs/common";

@EntityRepository(PostEntity)
export class PostRepository extends Repository<PostEntity> {

    private logger = new Logger('PostRepository');

    async createPost(createPostDto: CreatePostDto, user: User, imageUrls: string[]) : Promise<PostEntity> {
        const { title, description } = createPostDto;

        const createdAt = moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss');
        
        const post = this.create({ 
            title, 
            description,
            status: PostStatus.PUBLIC,
            user,
            createdAt,
            updatedAt: createdAt,
            imageUrls,
        })

        await this.save(post);

        this.logger.verbose(`${user.email}'s new post has created.`);
        return {
            id: post.id,
            title: post.title,
            description: post.description,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            status: post.status,
            imageUrls,
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
            .select(['post.id', 'post.title', 'post.description', 'post.status', 'post.createdAt', 'post.imageUrls', 'user.username', 'user.email'])
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
            .select(['post.id', 'post.title', 'post.description', 'post.status', 'post.createdAt', 'post.imageUrls', 'user.username', 'user.email'])
            .skip((page - 1) * limit)
            .take(limit);

            const [posts, total] = await query.getManyAndCount();

            this.logger.verbose(`post list length : ${posts.length}`);
            this.logger.verbose(`total : ${total}`);
    
            return { posts, total };
    }

}