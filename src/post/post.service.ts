import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PostStatus } from './post-status.enum';
import { CreatePostDto } from './dto/create-post.dto';
import { PostRepository } from './post.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { PostEntity } from './post.entity';
import { User } from 'src/user/user.entity';
import { CommentRepository } from 'src/comment/comment.repository';
import { CommentInfoDto, CommentInfoListDto } from 'src/comment/dto/comment-info.dto';
import { CreateCommentDto } from 'src/comment/dto/create-comment.dto';
import { PostResponse } from './dto/post-info.dto';
import { UpdateCommentDto } from 'src/comment/dto/update-comment.dto';

@Injectable()
export class PostService {
    constructor(
        @InjectRepository(PostRepository)
        private postRepository: PostRepository,
        @InjectRepository(CommentRepository)
        private commentRepository: CommentRepository,
    ) { }

    private logger = new Logger('PostService');

    async createPost(createPostDto: CreatePostDto, user: User, imageUrls: string[]): Promise<PostEntity> {
        return this.postRepository.createPost(createPostDto, user, imageUrls);
    }

    async getPostList(
        page: number,
        limit: number,
    ): Promise<PostResponse> {

        const postListResponse = await this.postRepository.getPostList(page, limit);

        return postListResponse;
    }

    async getPostListByUser(
        email: string,
        page: number,
        limit: number,
    ): Promise<PostResponse> {

        const postListResponse = await this.postRepository.getPostListByUser(email, page, limit);

        return postListResponse;
    }

    async likeUnlikePost(
        postId: number,
        email: string,
    ): Promise<string[]> {
        return await this.postRepository.likeUnlikePost(postId, email);
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

    async createComment(createCommentDto: CreateCommentDto, user: User): Promise<CommentInfoDto> {
        const post = await this.getPostById(createCommentDto.postId);
        return await this.commentRepository.createComment(createCommentDto, user, post);
    }

    async getCommentList(postId: number, page: number, limit: number): Promise<CommentInfoListDto> {
        return await this.commentRepository.getCommentList(postId, page, limit);
    }

    async updateComment(updateCommentDto: UpdateCommentDto, user: User): Promise<CommentInfoDto> {
        return await this.commentRepository.updateComment(updateCommentDto, user);
    }

    async createDummyPosts(count: number, user: User): Promise<void> {

        const totalDummy = 20;

        function shuffleArray(array: any[]): any[] {
            const newArray = [...array];
          
            for (let i = newArray.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
            }
          
            return newArray;
        }
          
        function generateRandomArray(): string[][] {
            const numbers = Array.from({ length: totalDummy }, (_, index) => index + 1);
            const shuffledNumbers = shuffleArray(numbers);
        
            const serverUrl = process.env.SERVER_URL;
            const result: string[][] = [];

            for (let i = 0; i < 10; i++) {
                const subset: string[] = [];
                subset.push(`${serverUrl}/images/dummy/${shuffledNumbers[i]}.jpeg`);
                result.push(subset);
            }

            for (let i = 10; i < shuffledNumbers.length; i++) {
                const randomIndex = Math.floor(Math.random() * 10);
                if (result[randomIndex].length < 3) {
                  result[randomIndex].push(`${serverUrl}/images/dummy/${shuffledNumbers[i]}.jpeg`);
                }
            }

            return result;
        }

        const shuffledImageNumbers = generateRandomArray();

        const words = ['Lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua'];
        function generateRandomSentence(): string {
            const sentenceLength = Math.floor(Math.random() * 20) + 3;
          
            let sentence = '';
          
            for (let i = 0; i < sentenceLength; i++) {
                const randomIndex = Math.floor(Math.random() * words.length);
                const word = words[randomIndex];
                sentence += word + ' ';
            }
          
            sentence = sentence.trim();
            sentence += '.';
          
            return sentence;
        }

        for (let i = 0; i < count; i++) {
            const post = new CreatePostDto();
            post.description = generateRandomSentence();

            await this.postRepository.createPost(post, user, shuffledImageNumbers[i]);
        }
    }

}
