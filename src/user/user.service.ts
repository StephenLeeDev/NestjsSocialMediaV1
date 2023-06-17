import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserRepository } from './user.repository';
import { UserInfoDto } from './dto/user-info.dto';
import { bookMarksDTO } from './dto/book-marks.dto';
import { PostRepository } from 'src/post/post.repository';

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
    
    async postBookMark(email: string, postId: number): Promise<bookMarksDTO> {
        const bookMarks = await this.userRepository.postBookMark(email, postId);
        if (bookMarks) {
            await this.postRepository.postBookMark(email, postId);
        }
        return bookMarks;
    }
    
}
