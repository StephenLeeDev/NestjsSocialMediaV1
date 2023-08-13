import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserRepository } from './user.repository';
import { UserInfoDto } from './dto/user-info.dto';
import { PostRepository } from 'src/post/post.repository';
import { UpdatedUserThumbnailDto } from './dto/updated-user-thumbnail.dto';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(UserRepository)
        private userRepository: UserRepository,
        @InjectRepository(PostRepository)
        private postRepository: PostRepository,
    ) {}

    async getUserInfo(email: string): Promise<UserInfoDto> {
        const userInfo = await this.userRepository.getUserInfo(email);
        return userInfo;
    }
    
    async postBookMark(email: string, postId: number): Promise<void> {
        const bookMarks = await this.userRepository.postBookMark(email, postId);
        if (bookMarks) {
            await this.postRepository.postBookMark(email, postId);
        }
    }
    
    async updateUserThumbnail(email: string, newThumbnailUrl: string): Promise<UpdatedUserThumbnailDto> {
        return await this.userRepository.updateUserThumbnail(email, newThumbnailUrl);
    }
    
    async updateStatusMessage(email: string, newStatusMessage: string): Promise<void> {
        return await this.userRepository.updateStatusMessage(email, newStatusMessage);
    }
    
}
