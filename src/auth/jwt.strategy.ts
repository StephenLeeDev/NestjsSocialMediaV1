import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../user/user.entity';
import { AuthRepository } from './auth.repository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authRepository: AuthRepository,
    configService: ConfigService,
  ) {
    super({
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  async validate(payload) {
    const { email } = payload;
    const user: User = await this.authRepository.findOneBy({ email });

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
