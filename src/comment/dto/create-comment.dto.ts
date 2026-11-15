import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Request body of POST /comment: write a comment on a post, or a reply to a
 * comment.
 *
 * - Without `parentCommentId` (or with `null`) → a top-level COMMENT on the post.
 * - With `parentCommentId`                     → a REPLY to that comment.
 *
 * This DTO only checks the SHAPE of the input. Rules that need the database
 * (does the post exist and is it visible? is the parent a top-level comment
 * on the same post?) are checked in CommentService.
 *
 * Fields such as type, author and timestamps are decided by the server and
 * are therefore not part of the request.
 */
export class CreateCommentDto {
  @ApiProperty({
    example: 'Write a comment here.',
    description: `The comment's content`,
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    example: 1,
    description: `The ID of the post being commented on.`,
  })
  @IsInt()
  postId: number;

  @ApiPropertyOptional({
    example: 7,
    nullable: true,
    description: `For a reply: the ID of the TOP-LEVEL comment being replied to. Omit or null for a normal comment.`,
  })
  // @IsOptional skips the other checks when the value is missing OR null.
  // (The Flutter app sends an explicit `null` for top-level comments.)
  @IsOptional()
  @IsInt()
  parentCommentId?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: `Accepted for compatibility but IGNORED: the server always uses the real author of the parent comment.`,
  })
  @IsOptional()
  @IsString()
  parentCommentAuthor?: string | null;
}
