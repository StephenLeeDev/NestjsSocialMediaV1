import { EntityRepository, Repository } from "typeorm";
import { CommentEntity } from "./comment.entity";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { CommentInfoDto } from "./dto/comment-info.dto";
import * as moment from 'moment-timezone';
import { Logger } from "@nestjs/common";
import { CommentType } from "./comment-type.enum";
import { User } from "src/user/user.entity";
import { PostEntity } from "src/post/post.entity";

@EntityRepository(CommentEntity)
export class CommentRepository extends Repository<CommentEntity> {

    private logger = new Logger('CommentRepository');

    async createComment(createCommentDto: CreateCommentDto, user: User, post: PostEntity): Promise<CommentInfoDto> {

        const { content, parentCommentId, parentCommentAuthor } = createCommentDto;

        const createdAt = moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss.SSS'); // You can set your time zone here
        var date = new Date(createdAt);
        
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

}