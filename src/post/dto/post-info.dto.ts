import { ApiProperty } from '@nestjs/swagger';
import { PostStatus } from '../post-status.enum';
import { UserSimpleInfoDto } from '../../user/dto/user-simple-info.dto';

/**
 * ============================================================================
 *  Post response DTOs
 * ============================================================================
 *
 * These classes describe what the API SENDS BACK for posts. They are never used
 * to read requests (request DTOs live in create-post.dto.ts etc.).
 *
 * Every PostInfoDto is built by `toPostInfoDto` in post.mapper.ts, so all
 * endpoints return exactly the same shape. The Flutter app's PostModel reads
 * these field names, so renaming a field here is a breaking API change.
 */

/** One post, as seen by a specific signed-in user (the "viewer"). */
export class PostInfoDto {
  @ApiProperty({
    example: 1,
    description: `The ID of the post.`,
  })
  id: number;

  @ApiProperty({
    example: 'This is a sample post description.',
    description: `The description of the post.`,
  })
  description: string;

  @ApiProperty({
    enum: PostStatus,
    example: PostStatus.PUBLIC,
    description: `PUBLIC posts appear in feeds; PRIVATE posts are visible to their author only.`,
  })
  status: PostStatus;

  @ApiProperty({
    example: '2023-06-13T12:34:56Z',
    description: `The date and time when the post was created.`,
  })
  createdAt: Date;

  @ApiProperty({
    example: '2023-06-13T12:34:56Z',
    description: `The date and time when the post was last updated.`,
  })
  updatedAt: Date;

  @ApiProperty({
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ],
    description: `The URLs of the images associated with the post.`,
  })
  imageUrls: string[];

  // A single object (the author), not a list.
  @ApiProperty({
    type: UserSimpleInfoDto,
    description: `The author of the post.`,
  })
  user: UserSimpleInfoDto;

  @ApiProperty({
    example: 3,
    description: `The total like count of the post.`,
  })
  likeCount: number;

  @ApiProperty({
    example: true,
    description: `Whether the VIEWER (the user making the request) liked the post.`,
  })
  isLiked: boolean;

  @ApiProperty({
    example: false,
    description: `Whether the VIEWER (the user making the request) bookmarked the post.`,
  })
  isBookmarked: boolean;

  @ApiProperty({
    example: 5,
    description: `The number of comments on the post, replies included.`,
  })
  commentCount: number;
}

/** One page of a post list (feed, "my posts", a user's posts). */
export class PostResponse {
  @ApiProperty({ type: [PostInfoDto], description: `The posts on this page.` })
  posts: PostInfoDto[];

  @ApiProperty({
    example: 10,
    description: `The total number of posts in the WHOLE list (all pages), used for paging.`,
  })
  total: number;
}
