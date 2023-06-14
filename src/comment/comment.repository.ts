import { EntityRepository, Repository } from "typeorm";
import { CommentEntity } from "./comment.entity";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { CommentInfoDto, CommentInfoListDto } from "./dto/comment-info.dto";
import * as moment from 'moment-timezone';
import { Logger, UnauthorizedException } from "@nestjs/common";
import { CommentType } from "./comment-type.enum";
import { User } from "src/user/user.entity";
import { PostEntity } from "src/post/post.entity";
import { UpdateCommentDto } from "./dto/update-comment.dto";

@EntityRepository(CommentEntity)
export class CommentRepository extends Repository<CommentEntity> {

    private logger = new Logger('CommentRepository');

    async createComment(createCommentDto: CreateCommentDto, user: User, post: PostEntity): Promise<CommentInfoDto> {

        const { content, parentCommentId, parentCommentAuthor } = createCommentDto;

        const createdAt = moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss.SSS'); // You can set your time zone here
        const date = new Date(createdAt);
        
        const comment = this.create({
            content,
            type: createCommentDto.parentCommentId == null ? CommentType.Comment : CommentType.Reply,
            parentCommentId,
            parentCommentAuthor,
            post,
            user,
            createdAt: date,
            updatedAt: date,
        });
    
        await this.save(comment);

        this.logger.verbose(`${user.email}'s new comment has created.`);

        var created = new CommentInfoDto();
        created.id = comment.id;
        created.content = comment.content;
        created.type = comment.type;
        created.parentCommentId = comment.parentCommentId;
        created.parentCommentAuthor = comment.parentCommentAuthor;
        created.postId = comment.post.id;
        created.email = comment.user.email;
        created.createdAt = comment.createdAt;
        created.updatedAt = comment.updatedAt;

        return created;
    }

    async getCommentList(postId: number, page: number, limit: number): Promise<CommentInfoListDto> {
        const query = this.createQueryBuilder('comment_entity')
        .leftJoinAndSelect('comment_entity.post', 'post')
        .leftJoinAndSelect('comment_entity.user', 'user')
        .where('comment_entity.postId = :postId', { postId })
        .orderBy('comment_entity.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);
    
      const [comments, total] = await query.getManyAndCount();
    
      const commentList: CommentInfoDto[] = comments.map((comment: CommentEntity) => {
        const commentInfo: CommentInfoDto = new CommentInfoDto();
        commentInfo.id = comment.id;
        commentInfo.content = comment.content;
        commentInfo.type = comment.type;
        commentInfo.parentCommentId = comment.parentCommentId;
        commentInfo.parentCommentAuthor = comment.parentCommentAuthor;
        commentInfo.postId = comment.post.id;
        commentInfo.email = comment.user.email;
        commentInfo.createdAt = comment.createdAt;
        commentInfo.updatedAt = comment.updatedAt;
        return commentInfo;
      });
    
      return { comments: commentList, total };
    }

    async updateComment(updateCommentDto: UpdateCommentDto, user: User): Promise<CommentInfoDto> {

        const { id, content } = updateCommentDto;
        const comment = await this.findOne(id, { relations: ['user', 'post'] });

        if (comment) {
            if (comment.user.email != user.email) {
                throw new UnauthorizedException('You do not have permission to update this comment');
            }
            else {
                const updatedAt = moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss.SSS'); // You can set your time zone here
                comment.updatedAt = new Date(updatedAt);
                comment.content = content;
                this.save(comment);
                
                var updatedComment = new CommentInfoDto();
                updatedComment.id = comment.id;
                updatedComment.content = comment.content;
                updatedComment.type = comment.type;
                updatedComment.parentCommentId = comment.parentCommentId;
                updatedComment.parentCommentAuthor = comment.parentCommentAuthor;
                updatedComment.postId = comment.post.id;
                updatedComment.email = comment.user.email;
                updatedComment.createdAt = comment.createdAt;
                updatedComment.updatedAt = comment.updatedAt;

                return updatedComment;
            }
        }
    }

}