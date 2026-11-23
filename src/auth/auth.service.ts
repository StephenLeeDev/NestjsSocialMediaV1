/**
 * ============================================================================
 *  AuthService: signing users in (and creating their account on first use)
 * ============================================================================
 *
 *   AuthController   → HTTP only
 *        │
 *   AuthService      → rules (THIS FILE)
 *        │             - the first sign-in creates the account
 *        │             - an email belongs to ONE provider (GOOGLE, ...)
 *        │             - every successful sign-in returns a token PAIR:
 *        │               a short-lived access token (JWT) and a refresh token
 *        │             - refresh and logout (POST /auth/refresh, /auth/logout)
 *        │
 *   RefreshTokenService → the refresh token rules (rotation, reuse detection)
 *   UserRepository      → database queries only (the user table belongs to the
 *                         user module; auth no longer has its own copy of it)
 *
 * How the token is checked on later requests is NOT in this file:
 *   - REST:      JwtStrategy (jwt.strategy.ts), used by `AuthGuard()`
 *   - Socket.IO: ChatGateway's handshake middleware
 *
 * Changes in this refactor (behaviour visible to clients is unchanged except
 * where the e2e tests say otherwise):
 *   - `signUp` was a separate public method only reachable through `signIn`
 *     (the /auth/signup route had been commented out). Its logic now lives
 *     in `signIn` itself; the ConflictException it threw could never happen.
 *   - Creating the account uses `UserRepository.insertIfMissing`
 *     (INSERT ... ON CONFLICT DO NOTHING), so two simultaneous first
 *     sign-ins can no longer make one of them fail with 409.
 *   - `jwtService.sign` (synchronous) was `await`ed; now `signAsync`.
 */
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { currentSeoulTimestamp } from '../common/utils/date.util';
import { DEFAULT_THUMBNAIL_PATH } from '../common/utils/image-url.util';
import { buildDummyUsers } from '../user/dummy/dummy-user-data';
import { User } from '../user/user.entity';
import { UserRepository } from '../user/user.repository';
import { AuthSocialType } from './auth-social-type.enum';
import { AuthCredentialsDto } from './dto/auth-credential.dto';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { JwtPayload } from './jwt-payload.interface';
import { RefreshTokenService } from './refresh-token/refresh-token.service';

/**
 * The shared account behind POST /auth/test ("sign in without Google"),
 * used during development and app review.
 */
const TEST_USER_CREDENTIALS: AuthCredentialsDto = {
  username: 'testUser',
  socialType: AuthSocialType.GOOGLE,
  email: 'testUser@gmail.com',
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userRepository: UserRepository,
    // Configured in AuthModule (secret and expiry come from the environment).
    private readonly jwtService: JwtService,
    // Issues, rotates and revokes refresh tokens.
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /**
   * Signs a user in, creating the account first if the email is new.
   *
   * Steps:
   *   1. find the account by email, or create it (first sign-in)
   *   2. check the provider: an email registered with one provider cannot
   *      sign in through another one
   *   3. return a new token pair; every sign-in starts a NEW session
   *      (a phone and a tablet each have their own refresh token)
   *
   * @throws ConflictException (409) when the email is registered with a
   *         different provider. (While GOOGLE is the only provider, the DTO
   *         already rejects every other value, so this cannot happen through
   *         HTTP yet. The rule stays for when a second provider is added.)
   */
  async signIn(credentials: AuthCredentialsDto): Promise<AuthTokensDto> {
    const { email, socialType } = credentials;
    const user = await this.findOrCreateUser(credentials);

    if (user.socialType !== socialType) {
      const message = `Sign in failed. ${email} is registered with ${user.socialType}.`;
      this.logger.warn(message);
      throw new ConflictException(message);
    }

    this.logger.verbose(`User ${email} has signed in`);
    return {
      accessToken: await this.issueAccessToken(email),
      refreshToken: await this.refreshTokenService.issue(email),
    };
  }

  /**
   * POST /auth/refresh: trades a refresh token for a NEW pair. The used
   * refresh token stops working (rotation); see RefreshTokenService.rotate.
   *
   * @throws UnauthorizedException (401) for an unknown, expired or reused
   *         token. The client must then sign in again.
   */
  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const rotated = await this.refreshTokenService.rotate(refreshToken);
    return {
      accessToken: await this.issueAccessToken(rotated.userEmail),
      refreshToken: rotated.refreshToken,
    };
  }

  /**
   * POST /auth/logout: ends the session of this refresh token, so it can no
   * longer be used to get new access tokens.
   *
   * The current ACCESS token keeps working until it expires: it is checked
   * by its signature only, without a database lookup. That is why access
   * tokens should be short-lived (see JWT_EXPIRES_IN_SECONDS). The client
   * simply deletes it.
   */
  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokenService.revokeSession(refreshToken);
  }

  /**
   * POST /auth/test: signs in as the shared test user (TEST_USER_CREDENTIALS),
   * creating it on the first call. Exactly the same as a normal sign-in.
   */
  signInAsTestUser(): Promise<AuthTokensDto> {
    return this.signIn(TEST_USER_CREDENTIALS);
  }

  /**
   * POST /auth/test/dummy: creates the ten development dummy users
   * (see user/dummy/dummy-user-data.ts). Users that already exist are left
   * untouched, so calling this repeatedly is harmless.
   */
  async createDummyUsers(): Promise<void> {
    await this.userRepository.insertIfMissing(buildDummyUsers());
  }

  // ==========================================================================
  //  Helpers
  // ==========================================================================

  /**
   * Returns the account for `credentials.email`, creating it if needed.
   *
   * Why "insert, then read again" instead of "read, and insert if missing":
   * two requests for the same new email can arrive at the same moment (a
   * double tap in the app). With `insertIfMissing` the database guarantees
   * that exactly one INSERT wins and the other is silently skipped, and the
   * second read then finds the row in both requests.
   */
  private async findOrCreateUser({
    username,
    socialType,
    email,
  }: AuthCredentialsDto): Promise<User> {
    const existing = await this.userRepository.findOneBy({ email });
    if (existing) {
      return existing;
    }

    await this.userRepository.insertIfMissing([
      {
        email,
        uuid: randomUUID(),
        username,
        socialType,
        // Seoul local time, like every other stored timestamp
        // (see common/utils/date.util.ts).
        createdAt: new Date(currentSeoulTimestamp()),
        // Every new account starts with the bundled default profile picture.
        thumbnail: DEFAULT_THUMBNAIL_PATH,
      },
    ]);
    this.logger.verbose(`Account ${email} has been created`);

    // `OrFail`: the row was either inserted just now or by a parallel
    // request, so it must exist. If not, something is badly wrong (500).
    return this.userRepository.findOneByOrFail({ email });
  }

  /** Creates a signed JWT (access token) for the user with this email. */
  private issueAccessToken(email: string): Promise<string> {
    const payload: JwtPayload = { email };
    return this.jwtService.signAsync(payload);
  }
}
