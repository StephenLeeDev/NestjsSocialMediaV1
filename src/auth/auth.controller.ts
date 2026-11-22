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
 *   POST /auth/refresh     trade a refresh token for a new token pair
 *   POST /auth/logout      end the session of a refresh token
 *   POST /auth/test        sign in as the shared test user (development)
 *   POST /auth/test/dummy  create the ten dummy users (development)
 *
 * The sign-in endpoints answer 201 Created, NestJS's default for POST. The
 * Flutter app relies on that status code, so it is kept although nothing is
 * "created" on a repeated sign-in. The NEW endpoints use the precise codes:
 * refresh → 200 OK, logout → 204 No Content.
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthCredentialsDto } from './dto/auth-credential.dto';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

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
  @ApiCreatedResponse({ type: AuthTokensDto })
  @ApiBadRequestResponse({
    description: 'Missing field, invalid email or unsupported socialType',
  })
  @ApiConflictResponse({
    description: 'The email is registered with another socialType',
  })
  signIn(
    // Validated by the global ValidationPipe (see app.setup.ts).
    @Body() credentials: AuthCredentialsDto,
  ): Promise<AuthTokensDto> {
    return this.authService.signIn(credentials);
  }

  @Post('/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a new token pair; the used refresh token stops working',
  })
  @ApiOkResponse({ type: AuthTokensDto })
  @ApiBadRequestResponse({ description: 'refreshToken missing or empty' })
  @ApiUnauthorizedResponse({
    description:
      'Unknown, expired or already used refresh token: sign in again',
  })
  refresh(@Body() { refreshToken }: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.authService.refresh(refreshToken);
  }

  @Post('/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'End the session of a refresh token (unknown tokens: no-op)',
  })
  @ApiNoContentResponse({ description: 'Done (no response body)' })
  logout(@Body() { refreshToken }: RefreshTokenDto): Promise<void> {
    return this.authService.logout(refreshToken);
  }

  @Post('/test')
  @ApiOperation({ summary: 'Sign in as the shared test user (development)' })
  @ApiCreatedResponse({ type: AuthTokensDto })
  signInAsTestUser(): Promise<AuthTokensDto> {
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
