/**
 * ============================================================================
 *  AuthController: the HTTP endpoints under /auth
 * ============================================================================
 *
 * Responsibility: HTTP only. Each method reads the request and hands it to
 * AuthService; every rule lives in the service.
 *
 * These are the only endpoints WITHOUT `AuthGuard()`: they are how a client
 * gets its token in the first place.
 *
 *   POST /auth/signin      sign in (creates the account on first use)
 *   POST /auth/test        sign in as the shared test user (development)
 *   POST /auth/test/dummy  create the ten dummy users (development)
 *
 * All three answer 201 Created, NestJS's default for POST. The Flutter app
 * relies on that status code, so it is kept although nothing is "created"
 * on a repeated sign-in.
 */
import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AccessTokenDto } from './dto/access-token.dto';
import { AuthCredentialsDto } from './dto/auth-credential.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // (A commented-out POST /auth/signup endpoint used to be here. Sign-up
  // happens automatically on the first sign-in, so it was removed.)

  @Post('/signin')
  @ApiOperation({
    summary: 'Sign in; the account is created on the first sign-in',
  })
  @ApiCreatedResponse({ type: AccessTokenDto })
  @ApiBadRequestResponse({
    description: 'Missing field, invalid email or unsupported socialType',
  })
  @ApiConflictResponse({
    description: 'The email is registered with another socialType',
  })
  signIn(
    // Validated by the global ValidationPipe (see app.setup.ts).
    @Body() credentials: AuthCredentialsDto,
  ): Promise<AccessTokenDto> {
    return this.authService.signIn(credentials);
  }

  @Post('/test')
  @ApiOperation({ summary: 'Sign in as the shared test user (development)' })
  @ApiCreatedResponse({ type: AccessTokenDto })
  signInAsTestUser(): Promise<AccessTokenDto> {
    return this.authService.signInAsTestUser();
  }

  @Post('/test/dummy')
  @ApiOperation({
    summary: 'Create the 10 dummy users; existing ones are kept (development)',
  })
  @ApiCreatedResponse({ description: 'Done (no response body)' })
  createDummyUsers(): Promise<void> {
    return this.authService.createDummyUsers();
  }
}
