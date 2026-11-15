import { ApiProperty } from '@nestjs/swagger';
import { CommentType } from '../comment-type.enum';
import { UserSimpleInfoDto } from '../../user/dto/user-simple-info.dto';

/**
 * ============================================================================
 *  Comment response DTOs
 * ============================================================================
 *
 * What the API SENDS BACK for comments and replies. Every CommentInfoDto is
 * built by `toCommentInfoDto` in comment.mapper.ts, so all endpoints return
 * the same shape. The Flutter app's CommentModel reads these field names.
 *
 * (These are response classes only. They used to carry validation decorators,
 * which made no sense: responses are never validated. Request bodies are
 * described by CreateCommentDto / UpdateCommentDto.)
 */

/** One comment or reply. */
export class CommentInfoDto {
  @ApiProperty({
    example: 1,
    description: `The ID of the comment.`,
  })
  id: number;

  @ApiProperty({
    example: 'Lorem ipsum',
    description: `The comment's content`,
  })
  content: string;

  @ApiProperty({
    enum: CommentType,
    example: CommentType.Comment,
    description: `COMMENT = written on the post, REPLY = written on a comment.`,
  })
  type: CommentType;

  @ApiProperty({
    example: 1,
    nullable: true,
    description: `For a reply: the ID of the comment it replies to. null for comments.`,
  })
  parentCommentId: number | null;

  @ApiProperty({
    example: 'john@gmail.com',
    nullable: true,
    description: `For a reply: the email of the parent comment's author. null for comments.`,
  })
  parentCommentAuthor: string | null;

  @ApiProperty({
    example: 1,
    description: `The ID of the post this comment belongs to.`,
  })
  postId: number;

  @ApiProperty({
    type: UserSimpleInfoDto,
    description: `The author of the comment.`,
  })
  user: UserSimpleInfoDto;

  @ApiProperty({
    example: `2022-06-12 06:00:22.206Z`,
    description: `When the comment was written.`,
  })
  createdAt: Date;

  @ApiProperty({
    example: `2022-06-12 06:00:22.206Z`,
    description: `When the comment was last edited.`,
  })
  updatedAt: Date;

  @ApiProperty({
    example: 3,
    description: `How many replies the comment has (always 0 for replies).`,
  })
  childrenCount: number;
}

/** One page of comments or replies. */
export class CommentInfoListDto {
  @ApiProperty({
    type: [CommentInfoDto],
    description: `The comments on this page.`,
  })
  comments: CommentInfoDto[];

  @ApiProperty({
    example: 10,
    description: `The total number of comments in the WHOLE list (all pages), used for paging.`,
  })
  total: number;
}
