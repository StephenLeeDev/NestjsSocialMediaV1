import { ApiProperty } from '@nestjs/swagger';

/**
 * A response that carries one number: `{ "value": 2 }`.
 *
 * Used by the follow endpoints:
 *   - POST   /follow                   → the followed user's NEW follower count
 *   - DELETE /follow/following/cancel  → that user's follower count afterwards
 *   - GET    /follow/follower/count    → your follower count
 *   - GET    /follow/following/count   → how many users you follow
 *
 * The Flutter app reads `value` after following / unfollowing.
 */
export class SingleIntegerDto {
  @ApiProperty({
    example: 2,
    description: `The requested number (see the endpoint's description)`,
  })
  value: number;

  /** Small factory so callers can write `SingleIntegerDto.of(count)`. */
  static of(value: number): SingleIntegerDto {
    const dto = new SingleIntegerDto();
    dto.value = value;
    return dto;
  }
}
