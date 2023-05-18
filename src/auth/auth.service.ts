import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthCredentialsDto } from './dto/auth-credential.dto';
import { UserRepository } from './user.repository';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(UserRepository)
        private userRepository: UserRepository,
        private jwtService: JwtService
    ) { }
    
    private logger = new Logger('AuthService');

    async signUp(authCredentialsDto: AuthCredentialsDto): Promise<{accessToken: string}> {
        await this.userRepository.createUser(authCredentialsDto);
        
        return this.signIn(authCredentialsDto);
    }

    async signIn(authCredentialsDto: AuthCredentialsDto): Promise<{accessToken: string}> {
        const { username, socialType, socialToken, email } = authCredentialsDto;
        const user = await this.userRepository.findOne({ email })

        if (user) {
            const payload = { email };
            const accessToken = await this.jwtService.sign(payload);

            this.logger.verbose(`User ${user.email} has signed in`);

            return { accessToken };
        } else {
            throw new UnauthorizedException('LogIn Failed')
        }
    }

    async test(): Promise<{ accessToken: string }> {
        const socialToken = 'testUser';
        const email = 'testUser@gmail.com';
        const user = await this.userRepository.findOne({ email })

        if (user) {
            this.logger.verbose(`test ${user}`);
            const accessToken = await this.jwtService.sign({ socialToken });
            return { accessToken };
        } else {
            this.logger.verbose(`user is null ${user}`);
            const testUserAuthDto = { socialToken, socialType: "GOOGLE", username: socialToken, email };
            await this.signUp(testUserAuthDto);

            const accessToken = await this.jwtService.sign({ socialToken });
            return { accessToken };
        }
    }

}
