import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

/**
 * Request body of PATCH /comment: change the text of your own comment.
 *
 * Only the author may edit a comment; CommentService enforces that.
 */
export class UpdateCommentDto {
  @ApiProperty({
    example: 1,
    description: `The ID of the comment to edit.`,
  })
  @IsInt()
  id: number;

  @ApiProperty({
    example: 'Lorem ipsum',
    description: `The new content`,
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
