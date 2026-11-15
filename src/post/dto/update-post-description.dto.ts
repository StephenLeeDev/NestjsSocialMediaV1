import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

/**
 * Request body of PATCH /post/description (edit a post's text).
 *
 * Only the author of the post may change it; that rule is enforced in
 * PostService.updateDescription, not here. This DTO only checks the SHAPE
 * of the input (types and required fields).
 */
export class UpdatePostDescriptionDto {
  @ApiProperty({
    example: 12,
    description: `The ID of the post to edit`,
  })
  @IsInt()
  postId: number;

  @ApiProperty({
    example: 'Write a description here',
    description: `The new description`,
  })
  @IsString()
  @IsNotEmpty()
  description: string;
}
