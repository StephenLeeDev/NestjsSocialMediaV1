/**
 * ============================================================================
 *  Comment mapper: CommentEntity (database row) → CommentInfoDto (API response)
 * ============================================================================
 *
 * The same field-by-field copy used to be written out four times in the
 * repository (create, list, replies, edit), and the copies had drifted apart
 * (replies left out `childrenCount`). One function keeps every response
 * identical. See post.mapper.ts for the same pattern.
 */
import { toUserSimpleInfoDto } from '../user/user.mapper';
import { CommentEntity } from './comment.entity';
import { CommentInfoDto } from './dto/comment-info.dto';

/**
 * Converts a comment loaded from the database into the API response shape.
 *
 * @param comment The comment. It must have been loaded WITH its author
 *                (`comment.user`) and at least the id of its post
 *                (`comment.post.id`). `comment.childrenCount` is filled in by
 *                CommentRepository and treated as 0 when missing.
 */
export function toCommentInfoDto(comment: CommentEntity): CommentInfoDto {
  const dto = new CommentInfoDto();
  dto.id = comment.id;
  dto.content = comment.content;
  dto.type = comment.type;
  // Top-level comments store NULL in these columns; `?? null` also turns a
  // missing value into null, so the JSON always contains both fields.
  dto.parentCommentId = comment.parentCommentId ?? null;
  dto.parentCommentAuthor = comment.parentCommentAuthor ?? null;
  dto.postId = comment.post.id;
  // Only the public parts of the author are exposed.
  dto.user = toUserSimpleInfoDto(comment.user);
  dto.createdAt = comment.createdAt;
  dto.updatedAt = comment.updatedAt;
  // Not a database column; computed by CommentRepository.
  dto.childrenCount = comment.childrenCount ?? 0;
  return dto;
}
