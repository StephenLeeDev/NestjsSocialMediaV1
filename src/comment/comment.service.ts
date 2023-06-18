import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { PostRepository } from "src/post/post.repository";
import { CommentRepository } from "./comment.repository";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { User } from "src/user/user.entity";
import { CommentInfoDto, CommentInfoListDto } from "./dto/comment-info.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";
import { PostEntity } from "src/post/post.entity";
import { UserRepository } from "src/user/user.repository";

@Injectable()
export class CommentService {
    constructor(
        @InjectRepository(PostRepository)
        private postRepository: PostRepository,
        @InjectRepository(CommentRepository)
        private commentRepository: CommentRepository,
        @InjectRepository(UserRepository)
        private userRepository: UserRepository,
    ) { }

    private logger = new Logger('PostService');

    async createComment(createCommentDto: CreateCommentDto, user: User): Promise<CommentInfoDto> {
        const post = await this.getPostById(createCommentDto.postId);
        return await this.commentRepository.createComment(createCommentDto, user, post);
    }

    async getCommentList(postId: number, page: number, limit: number): Promise<CommentInfoListDto> {
        return await this.commentRepository.getCommentList(postId, page, limit);
    }

    async getReplyListByParentCommentId(parentCommentId: number, postId: number, page: number, limit: number): Promise<CommentInfoListDto> {
        return await this.commentRepository.getReplyListByParentCommentId(parentCommentId, postId, page, limit);
    }

    async updateComment(updateCommentDto: UpdateCommentDto, user: User): Promise<CommentInfoDto> {
        return await this.commentRepository.updateComment(updateCommentDto, user);
    }

    async deleteComment(
        id: number,
        user: User,
    ): Promise<void> {
        const result = await this.commentRepository.delete({ id, user });

        if (result.affected === 0) {
            this.logger.error(`Can't find comment with id ${id}`);
            throw new NotFoundException(`Can't find comment with id ${id}`);
        }

        this.logger.verbose(`result ${result}`);
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

    // Create dummy comments or relies
    // A Comment represents a comment on a post, while a Reply represents a comment on a Comment.
    async createDummyComments(
        count: number,
        createCommentDto: CreateCommentDto,
    ): Promise<void> {

        const users = await this.userRepository.find({ take: 5 });
        
        const post = await this.postRepository.findOne(createCommentDto.postId);

        const words = ['Lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua'];
        function generateRandomSentence(): string {
            const sentenceLength = Math.floor(Math.random() * 10) + 3;
          
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

        users.map((user: User) => {
            createCommentDto.content = generateRandomSentence();

            this.commentRepository.createComment(createCommentDto, user, post);
        })

    }

}