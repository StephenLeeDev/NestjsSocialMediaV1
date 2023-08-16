import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from 'src/user/user.repository';
import { FollowRepository } from './follow.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/user/user.entity';
import { FollowListDto } from './dto/follow-list.dto';

@Injectable()
export class FollowService {
    constructor(
        @InjectRepository(UserRepository)
        private userRepository: UserRepository,
        @InjectRepository(FollowRepository)
        private followRepository: FollowRepository,
    ) {}

    private logger = new Logger('FollowService');

    async createFollow(follower: User, following: string): Promise<void> {

        const user = await this.userRepository.findOne({ email: following });

        return this.followRepository.createFollow(follower, user);
    }

    async getFollowerCount(email: string): Promise<number> {
        return await this.followRepository.getFollowerCount(email);
    }

    async getFollowingCount(email: string): Promise<number> {
        return await this.followRepository.getFollowingCount(email);
    }

    async cancelFollowing(follower: string, following: string): Promise<void> {
        await this.followRepository.createQueryBuilder('follow')
        .leftJoinAndSelect('follow.follower', 'follower')
        .leftJoinAndSelect('follow.following', 'following')
        .where('follower.email = :follower AND following.email = :following', { follower, following })
        .delete()
        .execute();
    }

    async getFollowerList(email: string, page: number, limit: number): Promise<FollowListDto> {
        return await this.followRepository.getFollowerList(email, page, limit);
    }

    async getFollowingList(email: string, page: number, limit: number): Promise<FollowListDto> {
        return await this.followRepository.getFollowingList(email, page, limit);
    }

}
