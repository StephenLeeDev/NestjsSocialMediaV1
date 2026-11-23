import { ApiProperty } from '@nestjs/swagger';
import { UserProfileDto } from './user-profile.dto';

/**
 * ANOTHER user's profile, as seen by the signed-in user (GET /user/:userEmail).
 *
 * Same public fields as every profile (see UserProfileDto), plus whether the
 * viewer follows this user. It deliberately does NOT include the user's
 * bookmarks: those are private. (It used to extend UserInfoDto and therefore
 * exposed them.)
 */
export class UserInfoIncludingIsFollowingDto extends UserProfileDto {
  @ApiProperty({
    example: true,
    description: `Whether the signed-in user follows this user.`,
  })
  isFollowing: boolean;
}
