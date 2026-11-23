/**
 * ============================================================================
 *  Post mapper: PostEntity (database row) → PostInfoDto (API response)
 * ============================================================================
 *
 * Why a mapper:
 *   The same ~15 lines that copy fields from a PostEntity into a PostInfoDto
 *   used to be written out four times (create, feed, user's posts, edit), and
 *   the copies had drifted apart: some forgot `likeCount`, others `updatedAt`.
 *   With one function, every endpoint returns the same shape, and adding a
 *   field means changing ONE place.
 *
 * Why a plain function (not an @Injectable service):
 *   It has no dependencies and no state; it only transforms data. A plain
 *   function is the simplest thing that works and is trivial to unit test.
 */
import { publicImageUrl } from '../common/utils/image-url.util';
import { toUserSimpleInfoDto } from '../user/user.mapper';
import { PostInfoDto } from './dto/post-info.dto';
import { PostEntity } from './post.entity';

/**
 * Converts a post loaded from the database into the API response shape.
 *
 * @param post The post. It must have been loaded WITH its author
 *             (`post.user`). Its numbers (`commentCount`, `likeCount`,
 *             `isLiked`, `isBookmarked`) should be filled in by
 *             `PostRepository.attachStats` for the user making the request;
 *             missing values count as 0 / false (e.g. a brand-new post).
 *
 * (It used to take the viewer's email as a second argument, to look the
 * viewer up in the post's arrays of likes and bookmarks. Those arrays are
 * gone; attachStats now asks the database for the viewer's flags.)
 */
export function toPostInfoDto(post: PostEntity): PostInfoDto {
  const dto = new PostInfoDto();
  dto.id = post.id;
  dto.description = post.description;
  dto.status = post.status;
  // Only the public parts of the author are exposed (no bookmarks, etc.).
  dto.user = toUserSimpleInfoDto(post.user);
  dto.createdAt = post.createdAt;
  dto.updatedAt = post.updatedAt;
  // The database stores image PATHS; the client needs full URLs built from
  // the current server address (see common/utils/image-url.util.ts).
  dto.imageUrls = post.imageUrls.map(publicImageUrl);

  // None of these are database columns: PostRepository.attachStats computes
  // them. The response reveals the COUNT of likes plus the viewer's own
  // status, never who liked or bookmarked the post.
  dto.likeCount = post.likeCount ?? 0;
  dto.isLiked = post.isLiked ?? false;
  dto.isBookmarked = post.isBookmarked ?? false;
  dto.commentCount = post.commentCount ?? 0;

  return dto;
}
