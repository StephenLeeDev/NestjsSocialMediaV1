import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserRepository } from './user.repository';
import { AuthRepository } from 'src/auth/auth.repository';
import { UserInfoDto } from './dto/user-info.dto';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(UserRepository)
        private userRepository: UserRepository,
    ) {}

    async getUserInfo(email: string): Promise<UserInfoDto> {
        
        const userInfo = await this.userRepository.getUserInfo(email);

        return userInfo;
    }
    
}
