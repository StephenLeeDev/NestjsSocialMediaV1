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
        const { email } = authCredentialsDto;

        const user = await this.userRepository.findOne({ email });

        // User account exists.
        if (user) {
            this.logger.error(`Sign up Failed. ${email} account already exists in ${user.socialType}.`);
            throw new ConflictException(`Sign up Failed. ${email} account already exists in ${user.socialType}.`)
        }
        // User account not exists. Sign in directly.
        else {
            await this.userRepository.createUser(authCredentialsDto);
            const accessToken = await this.jwtService.sign({ email });

            this.logger.verbose(`User ${email} has signed in`);

            return { accessToken };
        }
    }

    async signIn(authCredentialsDto: AuthCredentialsDto): Promise<{accessToken: string}> {
        const { socialType, email } = authCredentialsDto;
        const user = await this.userRepository.findOne({ email });

        // User account exists.
        if (user) {
            // User account exists.
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
            this.logger.error('Sign in Failed');
            throw new UnauthorizedException('Sign in Failed');
        }
    }

    async test(): Promise<{ accessToken: string }> {
        const username = 'testUser';
        const email = 'testUser@gmail.com';
        const user = await this.userRepository.findOne({ email });

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