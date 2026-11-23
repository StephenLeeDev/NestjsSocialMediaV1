/**
 * ============================================================================
 *  JwtStrategy: how `AuthGuard()` recognises the signed-in user
 * ============================================================================
 *
 * Every protected REST endpoint uses `@UseGuards(AuthGuard())`. For each
 * request, Passport then:
 *
 *   1. reads the token from the `Authorization: Bearer <token>` header
 *   2. checks its signature (JWT_SECRET) and expiry
 *      → missing, malformed, forged or expired token: 401, `validate` never runs
 *   3. calls `validate(payload)` below with the token's content
 *   4. stores what `validate` returns as `request.user`
 *      (controllers read it with the `@GetUser()` decorator)
 *
 * (Socket.IO connections are checked by ChatGateway with the same secret and
 * the same JwtPayload shape.)
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../user/user.entity';
import { UserRepository } from '../user/user.repository';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userRepository: UserRepository,
    configService: ConfigService,
  ) {
    super({
      // Must be the same secret that AuthModule signs tokens with.
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  /**
   * Turns a token that passed the signature check into the current user.
   *
   * The user row is loaded from the database on every request, so a token
   * of a deleted account stops working immediately, and controllers always
   * see the latest profile data (not a copy frozen inside the token).
   *
   * @throws UnauthorizedException (401) when no user has this email anymore.
   */
  async validate({ email }: JwtPayload): Promise<User> {
    const user = await this.userRepository.findOneBy({ email });
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
