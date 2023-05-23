import { Injectable, NotFoundException } from '@nestjs/common';
import { PostStatus } from './post-status.enum';
import { CreatePostDto } from './dto/create-post.dto';
import { PostRepository } from './post.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { PostEntity } from './post.entity';
import { User } from 'src/auth/user.entity';

@Injectable()
export class PostService {
    constructor(
        @InjectRepository(PostRepository)
        private postRepository: PostRepository,
    ) { }

    async getPostList(
        user: User,
    ): Promise<PostEntity[]> {
        const query = this.postRepository.createQueryBuilder('post');

        query.where('post.user.email = :email', { email: user.email })

        const posts = await query.getMany();
        return posts;
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

}
