import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

/**
 * Request body that only carries a post ID.
 *
 * Used by:
 *   - POST /post/:postId/like    (like / unlike)
 *   - POST /user/post/bookmark   (bookmark / un-bookmark)
 *
 * Note for the like endpoint: the post ID also appears in the URL, but the
 * server reads it from THIS body. The Flutter app relies on that (it sends the
 * literal text "{postId}" in the URL), so it stays like this until the app and
 * the server are changed together.
 */
export class PostIdDto {
  @ApiProperty({
    example: 12,
    description: `The ID of the post`,
  })
  // JSON numbers arrive as numbers, so a whole number is required here.
  // A missing value or a string like "12" is rejected with 400.
  @IsInt()
  postId: number;
}
