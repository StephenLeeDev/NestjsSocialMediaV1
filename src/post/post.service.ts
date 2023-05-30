import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PostStatus } from './post-status.enum';
import { CreatePostDto } from './dto/create-post.dto';
import { PostRepository } from './post.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { PostEntity, PostResponse } from './post.entity';
import { User } from 'src/user/user.entity';

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

        const postListResponse = await this.postRepository.getPostList(user, page, limit);

        return postListResponse;

    }

    async createPost(createPostDto: CreatePostDto, user: User, images: Express.Multer.File[]): Promise<PostEntity> {
        return this.postRepository.createPost(createPostDto, user, images);
    }

    async createPostTest(createPostDto: CreatePostDto, user: User, images: Express.Multer.File): Promise<PostEntity> {
        return this.postRepository.createPostTest(createPostDto, user, images);
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

    // async createDummyPosts(count: number, user: User): Promise<void> {
        
    //     for (let i = 0; i < count; i++) {
    //         const post = new CreatePostDto();
    //         post.title = `title ${i}`;
    //         post.description = `description ${i}`;
      
    //         await this.postRepository.createPost(post, user);
    //     }
    // }

}
