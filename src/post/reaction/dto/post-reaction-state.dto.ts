import { ApiProperty } from '@nestjs/swagger';

/**
 * ============================================================================
 *  Responses of the like / bookmark endpoints
 * ============================================================================
 *
 * The new endpoints (PUT / DELETE /post/:id/like and /post/:id/bookmark)
 * answer with the RESULTING state, so the app can show exactly what the
 * server stored, e.g. after a retry or when two devices act at once.
 * (The old toggle endpoints only returned the like count, or nothing at all
 * for bookmarks, so the app had to guess whether the toggle turned the
 * like / bookmark on or off.)
 */

/** Response of PUT / DELETE /post/:id/like. */
export class PostLikeStateDto {
  @ApiProperty({ example: 7, description: 'The post that was (un)liked' })
  postId: number;

  @ApiProperty({
    example: true,
    description: 'Whether YOU like the post now',
  })
  isLiked: boolean;

  @ApiProperty({
    example: 3,
    description: 'How many users like the post now (including you)',
  })
  likeCount: number;
}

/** Response of PUT / DELETE /post/:id/bookmark. */
export class PostBookmarkStateDto {
  @ApiProperty({ example: 7, description: 'The post that was (un)bookmarked' })
  postId: number;

  @ApiProperty({
    example: true,
    description: 'Whether the post is in YOUR bookmarks now',
  })
  isBookmarked: boolean;
}
