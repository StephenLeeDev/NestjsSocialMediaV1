import { ApiProperty } from '@nestjs/swagger';
import { UserProfileDto } from './user-profile.dto';

/**
 * The signed-in user's OWN profile (GET /user).
 *
 * Same public fields as every profile (see UserProfileDto), plus the
 * private bookmark list, which only its owner may see.
 */
export class UserInfoDto extends UserProfileDto {
  @ApiProperty({
    example: [1, 2],
    description: `IDs of the posts you bookmarked (private, only in your own profile).`,
  })
  bookMarks: number[];
}
