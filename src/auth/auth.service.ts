import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthCredentialsDto } from './dto/auth-credential.dto';
import { UserRepository } from './user.repository';
import { JwtService } from '@nestjs/jwt';
import { AuthSocialType } from './auth-social-type-validation.enum';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(UserRepository)
        private userRepository: UserRepository,
        private jwtService: JwtService
    ) { }
    
    private logger = new Logger('AuthService');

    async signUp(authCredentialsDto: AuthCredentialsDto): Promise<{accessToken: string}> {
        const { username, socialType, email } = authCredentialsDto;

        const user = await this.userRepository.findOne({ email })

        if (user) {
            throw new ConflictException(`LogIn Failed. ${email} account already exists.`)
        }
        else {
            await this.userRepository.createUser(authCredentialsDto);
            const accessToken = await this.jwtService.sign({ email });
            return { accessToken };
        }
    }

    async signIn(authCredentialsDto: AuthCredentialsDto): Promise<{accessToken: string}> {
        const { username, socialType, email } = authCredentialsDto;
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
        const username = 'testUser';
        const email = 'testUser@gmail.com';
        const user = await this.userRepository.findOne({ email })

        if (user) {
            const accessToken = await this.jwtService.sign({ email });
            return { accessToken };
        } else {
            this.logger.verbose(`The textUser not exists`);
            const testUserAuthDto = { username, socialType: AuthSocialType.GOOGLE, email };
            await this.signUp(testUserAuthDto);

            const accessToken = await this.jwtService.sign({ email });
            return { accessToken };
        }
    }

}