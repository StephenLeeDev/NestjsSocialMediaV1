import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PostStatus } from './post-status.enum';
import { CreatePostDto } from './dto/create-post.dto';
import { PostRepository } from './post.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/user/user.entity';
import { PostInfoDto, PostResponse } from './dto/post-info.dto';
import { UserInfoDto } from 'src/user/dto/user-info.dto';
import { AuthRepository } from 'src/auth/auth.repository';
import { UserRepository } from 'src/user/user.repository';
import { PostLikeCountDto } from './dto/post-like-count.dto';
import { UpdatePostDescriptionDto } from './dto/update-post-description.dto';

@Injectable()
export class PostService {
    constructor(
        @InjectRepository(PostRepository)
        private postRepository: PostRepository,
        @InjectRepository(UserRepository)
        private userRepository: UserRepository,
        @InjectRepository(AuthRepository)
        private authRepository: AuthRepository,
    ) { }

    private logger = new Logger('PostService');

    async createPost(createPostDto: CreatePostDto, user: User, imageUrls: string[]): Promise<PostInfoDto> {
        return this.postRepository.createPost(createPostDto, user, imageUrls);
    }

    async getPostList(
        email: string,
        page: number,
        limit: number,
    ): Promise<PostResponse> {

        const postListResponse = await this.postRepository.getPostList(email, page, limit);

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
    ): Promise<PostLikeCountDto> {
        return await this.postRepository.likeUnlikePost(postId, email);
    }

    async getPostById(email: string, id: number): Promise<PostInfoDto> {
        const post = await this.postRepository
            .createQueryBuilder('post')
            .leftJoinAndSelect('post.user', 'user')
            .leftJoin('post.comments', 'comment_entity')
            .loadRelationCountAndMap('post.commentCount', 'post.comments')
            .where('post.id = :id', { id })
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
            .getOne();
      
        if (!post) {
            this.logger.error(`Can't find Post with id ${id}`);
            throw new NotFoundException(`Can't find Post with id ${id}`);
        }
      
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
      
        this.logger.verbose(`post : ${postInfo}`);
        return postInfo;
    }

    async updatePostDescription(
        email: string,
        updatePostDescriptionDto: UpdatePostDescriptionDto,
    ): Promise<PostInfoDto> {

        const postInfoDto = await this.postRepository.updatePostDescription(email, updatePostDescriptionDto);

        return postInfoDto;
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

    async updatePostStatus(email: string, id: number): Promise<void> {
        const post = await this.getPostById(email, id);

        if (!post) {
            this.logger.error(`Can't find Post with id ${id}`);
            throw new NotFoundException(`Can't find Post with id ${id}`);
        }
    
        post.status = post.status == PostStatus.PUBLIC ? PostStatus.PRIVATE : PostStatus.PUBLIC;
        await this.postRepository.save(post);
    }

    async createDummyPosts(): Promise<void> {

        const count = 5;

        let users = await this.userRepository.find({ take: count });

        if (users.length < count) {
            await this.authRepository.createDummyUsers();
            users = await this.userRepository.find({ take: count });
        }

        const duplicatedUsers = [...users, ...users.slice(0, count - users.length)];
        const shuffledUsers = shuffleArray(duplicatedUsers);
        
        const totalImageCount = 20;

        function shuffleArray(array: any[]): any[] {
            const newArray = [...array];
          
            for (let i = newArray.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
            }
          
            return newArray;
        }
          
        function generateRandomArray(): string[][] {
            const numbers = Array.from({ length: totalImageCount }, (_, index) => index + 1);
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

        shuffledUsers.map((user: User, index: number) => {
            const post = new CreatePostDto();
            post.description = generateRandomSentence();
        
            // Add a slight delay to slow down the dummy data creation speed
            // to prevent all dummy comments from having the same createdAt value
            setTimeout(async () => {
                await this.postRepository.createPost(post, user, shuffledImageNumbers[index]);
            }, index * 1);
        })
    }

}
