import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Request body of POST /auth/refresh and POST /auth/logout. */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'The refresh token from the last sign-in or refresh',
    example: 'Jq3n0lF0hS4o2x9Wc8m7Vb1Kt5Yd6Rz0aPe3Lg2Hu4I',
  })
  // Missing or empty → 400 (the request itself is malformed).
  // A well-formed but invalid token is a 401, decided by the service.
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
