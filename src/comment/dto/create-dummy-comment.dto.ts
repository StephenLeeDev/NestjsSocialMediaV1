import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';

/**
 * Request body of POST /comment/test/dummy (development helper).
 *
 * Creates 10 random comments on a post, or 10 random replies to one comment
 * when `parentCommentId` is given. The same rules as for real comments apply
 * (see CreateCommentDto and CommentService).
 */
export class CreateDummyCommentDto {
  @ApiProperty({
    example: 1,
    description: `The post to fill with dummy comments.`,
  })
  @IsInt()
  postId: number;

  @ApiPropertyOptional({
    example: 7,
    nullable: true,
    description: `When given, dummy REPLIES are created under this top-level comment.`,
  })
  @IsOptional()
  @IsInt()
  parentCommentId?: number | null;
}
