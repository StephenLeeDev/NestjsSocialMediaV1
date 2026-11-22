import { ApiProperty } from '@nestjs/swagger';

/**
 * Response of GET /follow/isFollowing.
 *
 * Wrapped in an object instead of returning a bare `true` / `false`: a bare
 * value is not a JSON object, clients handle it differently from every other
 * response, and no field could ever be added to it later.
 */
export class IsFollowingDto {
  @ApiProperty({
    example: true,
    description: `Whether the signed-in user follows the given user`,
  })
  isFollowing: boolean;
}
