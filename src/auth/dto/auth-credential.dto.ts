import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { AuthSocialType } from '../auth-social-type.enum';

/**
 * Request body of POST /auth/signin.
 *
 * The Flutter app signs the user in with Google first, then sends the Google
 * account's name and email here.
 *
 * Every field is checked by the global ValidationPipe (see app.setup.ts);
 * a request that breaks any rule below is answered with 400 Bad Request
 * before AuthService runs.
 *
 * SECURITY NOTE (unchanged by this refactor, planned for the API-contract
 * step together with the Flutter app): the server trusts these values as
 * they are. Whoever knows an email address can sign in as that user. The fix
 * is to send Google's ID token instead and verify it on the server.
 */
export class AuthCredentialsDto {
  @ApiProperty({
    example: 'John',
    description: `User's name (only used when the account is created)`,
  })
  // Must be text with at least one character.
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    enum: AuthSocialType,
    example: AuthSocialType.GOOGLE,
    description: `The provider the user signed in with`,
  })
  // Only the providers listed in AuthSocialType ("GOOGLE").
  // Before this refactor ANY text was accepted, so a typo created an account
  // that could never be signed into with the real provider again.
  @IsEnum(AuthSocialType)
  socialType: AuthSocialType;

  @ApiProperty({
    example: 'john@gmail.com',
    description: `User's email address (identifies the account)`,
  })
  // Must look like an email address ("not-an-email" → 400).
  @IsEmail()
  email: string;
}
