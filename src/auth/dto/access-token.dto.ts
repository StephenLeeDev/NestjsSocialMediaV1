import { ApiProperty } from '@nestjs/swagger';

/**
 * Response body of every endpoint that signs a user in
 * (POST /auth/signin and POST /auth/test).
 *
 * The Flutter app stores this token and sends it back on every later request
 * as `Authorization: Bearer <accessToken>` (and as `auth.token` when it opens
 * the chat socket).
 *
 * Before this refactor Swagger described this response as a plain `String`,
 * although the real response has always been this JSON object.
 */
export class AccessTokenDto {
  @ApiProperty({
    description: 'JWT to send as "Authorization: Bearer <token>"',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;
}
