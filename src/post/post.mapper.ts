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
import { UserSimpleInfoDto } from '../user/dto/user-simple-info.dto';
import { PostInfoDto } from './dto/post-info.dto';
import { PostEntity } from './post.entity';

/**
 * Converts a post loaded from the database into the API response shape.
 *
 * @param post        The post. It must have been loaded WITH its author
 *                    (`post.user`), and `post.commentCount` should be filled in
 *                    by `PostRepository.attachCommentCounts` (treated as 0 if not).
 * @param viewerEmail Email of the signed-in user making the request. The
 *                    "personal" flags `isLiked` / `isBookmarked` are computed
 *                    for THIS user, because the same post looks different to
 *                    different people.
 */
export function toPostInfoDto(
  post: PostEntity,
  viewerEmail: string,
): PostInfoDto {
  // Only the public parts of the author are exposed (no bookmarks, etc.).
  const author = new UserSimpleInfoDto();
  author.email = post.user.email;
  author.username = post.user.username;
  author.thumbnail = post.user.thumbnail;

  const dto = new PostInfoDto();
  dto.id = post.id;
  dto.description = post.description;
  dto.status = post.status;
  dto.user = author;
  dto.createdAt = post.createdAt;
  dto.updatedAt = post.updatedAt;
  dto.imageUrls = post.imageUrls;

  // `likes` and `bookMarkedUsers` are lists of user emails stored on the post.
  // The response only reveals the COUNT of likes plus the viewer's own status,
  // never the list of who liked it.
  dto.likeCount = post.likes.length;
  dto.isLiked = post.likes.includes(viewerEmail);
  dto.isBookmarked = post.bookMarkedUsers.includes(viewerEmail);

  // `commentCount` is not a database column; the repository computes it.
  dto.commentCount = post.commentCount ?? 0;

  return dto;
}
