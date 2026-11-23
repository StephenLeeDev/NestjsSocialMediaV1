import { ApiProperty } from '@nestjs/swagger';

/**
 * ============================================================================
 *  Profile response DTOs
 * ============================================================================
 *
 * Profiles come in two flavours that share these PUBLIC fields:
 *
 *   UserProfileDto                     ← public fields (this class)
 *     ├── UserInfoDto                  ← GET /user          (your own profile)
 *     │      + bookMarks                 (private: only you see your bookmarks)
 *     └── UserInfoIncludingIsFollowingDto ← GET /user/:email (someone else)
 *            + isFollowing
 *
 * Before this split, the "someone else" profile extended the "own profile"
 * class and therefore leaked the other user's bookmark list.
 *
 * All profiles are built in UserService via user.mapper.ts. The Flutter app's
 * MyUserInfo / DetailUserInfoModel read these field names.
 */
export class UserProfileDto {
  @ApiProperty({
    example: 'john@gmail.com',
    description: `User's email address (also the user's unique id).`,
  })
  email: string;

  @ApiProperty({ example: 'John', description: `User's display name.` })
  username: string;

  @ApiProperty({
    example: 'http://localhost:3001/images/default/dafault_thumbnail.png',
    description: `Full URL of the profile picture.`,
  })
  thumbnail: string;

  @ApiProperty({ example: `I'm hungry`, description: `User's status message.` })
  statusMessage: string;

  @ApiProperty({
    example: 5,
    description: `Number of the user's PUBLIC posts.`,
  })
  totalPostCount: number;

  @ApiProperty({ example: 5, description: `How many users follow this user.` })
  followerCount: number;

  @ApiProperty({ example: 7, description: `How many users this user follows.` })
  followingCount: number;
}
