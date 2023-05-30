import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PostStatus } from './post-status.enum';
import { CreatePostDto } from './dto/create-post.dto';
import { PostRepository } from './post.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { PostEntity, PostResponse } from './post.entity';
import { User } from 'src/user/user.entity';
import { AuthRepository } from 'src/auth/auth.repository';

@Injectable()
export class PostService {
    constructor(
        @InjectRepository(PostRepository)
        private postRepository: PostRepository,
    ) { }

    private logger = new Logger('PostService');

    async getPostList(
        user: User,
        page: number,
        limit: number,
    ): Promise<PostResponse> {
        const query = this.postRepository.createQueryBuilder('post');

        query
            .where('post.user.email = :email', { email: user.email })
            .andWhere('post.status = :status', { status: PostStatus.PUBLIC })
            .leftJoinAndSelect('post.user', 'user')
            .select(['post.id', 'post.title', 'post.description', 'post.status', 'user.username', 'user.email'])
            .skip((page - 1) * limit)
            .take(limit);

        const [posts, total] = await query.getManyAndCount();

        posts.map((post) => {
            this.logger.verbose(`post : ${post}`);
        });
        this.logger.verbose(`total : ${total}`);

        return { posts, total };

    }

    createPost(createPostDto: CreatePostDto, user: User): Promise<PostEntity> {
        return this.postRepository.createPost(createPostDto, user);
    }

    async getPostById(id: number): Promise<PostEntity> {
        const post = await this.postRepository.findOne(id);

        if (!post) {
            this.logger.error(`Can't find Post with id ${id}`);
            throw new NotFoundException(`Can't find Post with id ${id}`);
        }

        this.logger.verbose(`post : ${post}`);
        return post;
    }

    async deletePost(
        id: number,
        user: User,
    ): Promise<void> {
        const result = await this.postRepository.delete({ id, user });

        if (result.affected === 0) {
            this.logger.error(`Can't find Post with id ${id}`);
            throw new NotFoundException(`Can't find Post with id ${id}`);
        }

        this.logger.verbose(`result ${result}`);
    }

    async updatePostStatus(id: number, status: PostStatus): Promise<PostEntity> {
        const post = await this.getPostById(id);

        post.status = status;
        await this.postRepository.save(post);

        return post;
    }

    async createDummyPosts(count: number, user: User): Promise<void> {
        
        for (let i = 0; i < count; i++) {
            const post = new PostEntity();
            post.title = `title ${i}`;
            post.description = `description ${i}`;
            post.status = PostStatus.PUBLIC;
      
            await this.postRepository.createPost(post, user);
        }
    }

}
