import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserRepository } from './user.repository';
import { UserInfoDto } from './dto/user-info.dto';
import { PostRepository } from 'src/post/post.repository';
import { UpdatedUserThumbnailDto } from './dto/updated-user-thumbnail.dto';
import { FollowRepository } from 'src/follow/follow.repository';
import { UserInfoIncludingIsFollowingDto } from './dto/user-info-including-isfollowing.dto';
import { UserListDto } from './dto/user-list.dto';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(UserRepository)
        private userRepository: UserRepository,
        @InjectRepository(PostRepository)
        private postRepository: PostRepository,
        @InjectRepository(FollowRepository)
        private followRepository: FollowRepository,
    ) {}

    async getUserInfo(email: string): Promise<UserInfoDto> {
        const userInfo = await this.userRepository.getUserInfo(email);
        return userInfo;
    }

    async getUserInfoByEmail(myEmail: string, userEmail: string): Promise<UserInfoIncludingIsFollowingDto> {
        const userInfoIncludingIsFollowing = new UserInfoIncludingIsFollowingDto();

        const userInfo = await this.userRepository.getUserInfo(userEmail);
        userInfoIncludingIsFollowing.email = userInfo.email
        userInfoIncludingIsFollowing.username = userInfo.username
        userInfoIncludingIsFollowing.thumbnail = userInfo.thumbnail
        userInfoIncludingIsFollowing.bookMarks = userInfo.bookMarks
        userInfoIncludingIsFollowing.statusMessage = userInfo.statusMessage
        userInfoIncludingIsFollowing.totalPostCount = userInfo.totalPostCount
        userInfoIncludingIsFollowing.followerCount = userInfo.followerCount
        userInfoIncludingIsFollowing.followingCount = userInfo.followingCount

        const isFollowing = await this.followRepository.getIsFollowing(myEmail, userEmail);
        userInfoIncludingIsFollowing.isFollowing = isFollowing;

        return userInfoIncludingIsFollowing;
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
    
    async getUserListByKeyword(keyword: string, page: number, limit: number): Promise<UserListDto> {
        return await this.userRepository.getUserListByKeyword(keyword, page, limit);
    }

}
