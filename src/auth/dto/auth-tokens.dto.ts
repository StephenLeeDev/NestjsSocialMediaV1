import { ApiProperty } from '@nestjs/swagger';

/**
 * Response body of every endpoint that signs a user in or renews the tokens
 * (POST /auth/signin, POST /auth/test, POST /auth/refresh).
 *
 * How the Flutter app uses the two tokens:
 *   - accessToken:  sent with every request as `Authorization: Bearer <token>`
 *                   (and as `auth.token` when it opens the chat socket)
 *   - refreshToken: kept in secure storage and sent ONLY to POST /auth/refresh
 *                   when the access token has expired (401). The answer is a
 *                   NEW pair; both old tokens must be replaced.
 *
 * (This class used to be AccessTokenDto, with the access token only. Adding
 * `refreshToken` does not break the current app, which simply ignores it.)
 */
export class AuthTokensDto {
  @ApiProperty({
    description: 'Short-lived JWT to send as "Authorization: Bearer <token>"',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description:
      'Long-lived token for POST /auth/refresh. Each use replaces it; ' +
      'store the new one every time.',
    example: 'Jq3n0lF0hS4o2x9Wc8m7Vb1Kt5Yd6Rz0aPe3Lg2Hu4I',
  })
  refreshToken: string;
}
