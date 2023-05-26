import { Injectable, NotFoundException } from '@nestjs/common';
import { PostStatus } from './post-status.enum';
import { CreatePostDto } from './dto/create-post.dto';
import { PostRepository } from './post.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { PostEntity, PostResponse } from './post.entity';
import { User } from 'src/auth/user.entity';
import { UserRepository } from 'src/auth/user.repository';

@Injectable()
export class PostService {
    constructor(
        @InjectRepository(PostRepository)
        private postRepository: PostRepository,
        private userRepository: UserRepository,
    ) { }

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

        return { posts, total };

    }

    createPost(createPostDto: CreatePostDto, user: User): Promise<PostEntity> {
        return this.postRepository.createPost(createPostDto, user);
    }

    async getPostById(id: number): Promise<PostEntity> {
        const found = await this.postRepository.findOne(id);

        if (!found) {
            throw new NotFoundException(`Can't find Post with id ${id}`);
        }

        return found;
    }

    async deletePost(
        id: number,
        user: User,
    ): Promise<void> {
        const result = await this.postRepository.delete({ id, user});

        if (result.affected === 0) {
            throw new NotFoundException(`Can't find Post with id ${id}`);
        }

        console.log('result', result);
    }

    async updatePostStatus(id: number, status: PostStatus): Promise<PostEntity> {
        const post = await this.getPostById(id);

        post.status = status;
        await this.postRepository.save(post);

        return post;
    }

    async createDummyPosts(count: number): Promise<void> {
        
        const email = 'testUser@gmail.com';
        const user = await this.userRepository.findOne({ email })

        for (let i = 0; i < count; i++) {
            const post = new PostEntity();
            post.title = `title ${i}`;
            post.description = `description ${i}`;
            post.status = PostStatus.PUBLIC;
            // 여기서 필요에 따라 다른 필드 설정
      
            await this.postRepository.createPost(post, user);
          }
    }

}
