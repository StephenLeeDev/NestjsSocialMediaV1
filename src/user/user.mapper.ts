/**
 * ============================================================================
 *  User mappers: User entity → the different "user" response shapes
 * ============================================================================
 *
 * A user appears in responses at three levels of detail:
 *
 *   toUserSimpleInfoDto  → email, username, thumbnail
 *                          (author of a post / comment)
 *   toUserSummaryDto     → + statusMessage
 *                          (search results, follower lists, chat partners)
 *   profiles             → + counts (+ bookmarks or isFollowing)
 *                          (built in UserService, see dto/user-profile.dto.ts)
 *
 * Every module that needs one of the small shapes uses these functions, so a
 * user looks the same everywhere and private fields can never slip into a
 * response by accident.
 */
import { UserSimpleInfoIncludingStatusMessageDto } from './dto/user-simple-info-including-status-message.dto';
import { UserSimpleInfoDto } from './dto/user-simple-info.dto';
import { User } from './user.entity';

/** The minimal public view of a user: who they are and what they look like. */
export function toUserSimpleInfoDto(user: User): UserSimpleInfoDto {
  const dto = new UserSimpleInfoDto();
  dto.email = user.email;
  dto.username = user.username;
  dto.thumbnail = user.thumbnail;
  return dto;
}

/** The minimal view plus the status message, used in user lists. */
export function toUserSummaryDto(
  user: User,
): UserSimpleInfoIncludingStatusMessageDto {
  const dto = new UserSimpleInfoIncludingStatusMessageDto();
  dto.email = user.email;
  dto.username = user.username;
  dto.thumbnail = user.thumbnail;
  dto.statusMessage = user.statusMessage;
  return dto;
}
