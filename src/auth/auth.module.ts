/**
 * Wires authentication together: sign-in endpoints, token creation and the
 * JWT guard used by every other module.
 *
 * Other modules import AuthModule to get:
 *   - PassportModule + JwtStrategy → `@UseGuards(AuthGuard())` on REST routes
 *   - JwtModule                    → JwtService, e.g. ChatGateway verifies the
 *                                    token of every Socket.IO connection
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserRepository } from '../user/user.repository';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RefreshTokenRepository } from './refresh-token/refresh-token.repository';
import { RefreshTokenService } from './refresh-token/refresh-token.service';

/**
 * Token lifetime used when JWT_EXPIRES_IN_SECONDS is not set.
 *
 * 60 * 60 * 365 seconds = 131,400 seconds ≈ 36.5 hours. That is the value the
 * project has always used; it LOOKS like it was meant to be "365 days"
 * (which would be 60 * 60 * 24 * 365). It is kept unchanged here because
 * changing how long users stay signed in is a product decision, not a style
 * refactor. (.env.example sets 21,900 seconds ≈ 6 hours.)
 *
 * With refresh tokens (see refresh-token/), access tokens SHOULD be short-
 * lived, typically 15 minutes: a leaked access token cannot be revoked, so
 * its lifetime is the damage window. It stays long for now because the
 * current Flutter app does not call POST /auth/refresh yet and would sign the
 * user out every 15 minutes. Shorten it once the app refreshes on 401.
 */
const DEFAULT_JWT_EXPIRES_IN_SECONDS = 60 * 60 * 365;

@Module({
  imports: [
    // `AuthGuard()` without arguments uses this default strategy ('jwt').
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // `registerAsync` + ConfigService: the secret is read from the
    // environment at startup instead of being written in the source code.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // Startup fails loudly if JWT_SECRET is missing.
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: Number(
            configService.get<string>(
              'JWT_EXPIRES_IN_SECONDS',
              String(DEFAULT_JWT_EXPIRES_IN_SECONDS),
            ),
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    RefreshTokenService,
    RefreshTokenRepository,
    // The user table belongs to the user module; auth only reads and
    // creates rows through the same repository. (Auth used to have its own
    // `AuthRepository` for the same table.)
    UserRepository,
  ],
  exports: [JwtStrategy, PassportModule, JwtModule],
})
export class AuthModule {}
