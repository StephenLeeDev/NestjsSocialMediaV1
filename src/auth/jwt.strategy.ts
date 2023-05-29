import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { InjectRepository } from "@nestjs/typeorm";
import { ExtractJwt, Strategy } from "passport-jwt";
import { User } from "../user/user.entity";
import { AuthRepository } from "./auth.repository";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        @InjectRepository(AuthRepository)
        private authRepository: AuthRepository
    ) {
        super({
            secretOrKey: "Secret1234",
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
        })
    }

    async validate(payload) {
        const { email } = payload;
        const user: User = await this.authRepository.findOne({ email });

        if (!user) {
            throw new UnauthorizedException();
        }

        return user;
    }

}