import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthCredentialsDto } from './dto/auth-credential.dto';
import { AuthRepository } from './auth.repository';
import { JwtService } from '@nestjs/jwt';
import { AuthSocialType } from './auth-social-type-validation.enum';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(AuthRepository)
        private authRepository: AuthRepository,
        private jwtService: JwtService
    ) { }
    
    private logger = new Logger('AuthService');

    async signUp(authCredentialsDto: AuthCredentialsDto): Promise<{accessToken: string}> {
        const { email } = authCredentialsDto;

        const user = await this.authRepository.findOne({ email });

        // User account exists.
        if (user) {
            this.logger.error(`Sign up Failed. ${email} account already exists in ${user.socialType}.`);
            throw new ConflictException(`Sign up Failed. ${email} account already exists in ${user.socialType}.`)
        }
        // User account not exists. Sign in directly.
        else {
            await this.authRepository.createUser(authCredentialsDto);
            const accessToken = await this.jwtService.sign({ email });

            return { accessToken };
        }
    }

    async signIn(authCredentialsDto: AuthCredentialsDto): Promise<{accessToken: string}> {
        const { socialType, email } = authCredentialsDto;
        const user = await this.authRepository.findOne({ email });

        // User account exists.
        if (user) {
            if (user.socialType == socialType) {
                const payload = { email };
                const accessToken = await this.jwtService.sign(payload);
    
                this.logger.verbose(`User ${user.email} has signed in`);
    
                return { accessToken };
            }
            else {
                this.logger.error(`Sign in Failed. ${email} account already exists in ${user.socialType}.`);
                throw new ConflictException(`Sign in Failed. ${email} account already exists in ${user.socialType}.`);
            }
        } else {
            return this.signUp(authCredentialsDto);
        }
    }

    async test(): Promise<{ accessToken: string }> {
        const username = 'testUser';
        const email = 'testUser@gmail.com';
        const user = await this.authRepository.findOne({ email });

        if (user) {
            const accessToken = await this.jwtService.sign({ email });

            this.logger.verbose(`User ${user.email} has signed in`);
    
            return { accessToken };
        } else {
            const testUserAuthDto = { username, socialType: AuthSocialType.GOOGLE, email };
            await this.signUp(testUserAuthDto);

            const accessToken = await this.jwtService.sign({ email });

            this.logger.verbose(`User ${email} has signed in`);
    
            return { accessToken };
        }
    }

}