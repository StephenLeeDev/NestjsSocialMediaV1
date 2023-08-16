import { EntityRepository, Repository } from "typeorm";
import { Follow } from "./follow.entity";
import { Logger } from "@nestjs/common";
import { User } from "src/user/user.entity";
import { FollowListDto } from "./dto/follow-list.dto";
import { UserInfoDto } from "src/user/dto/user-info.dto";

@EntityRepository(Follow)
export class FollowRepository extends Repository<Follow> {

    private logger = new Logger('FollowRepository');

    async createFollow(follower: User, following: User): Promise<void> {
        
        const follow = this.create({
            follower,
            following,
        })

        await this.save(follow);
    }

    async getFollowerCount(email: string): Promise<number> {
        return this.createQueryBuilder('follow')
            .leftJoinAndSelect('follow.following', 'following')
            .where('following.email = :email', { email })
            .getCount();
    }

    async getFollowingCount(email: string): Promise<number> {
        return this.createQueryBuilder('follow')
            .leftJoinAndSelect('follow.follower', 'follower')
            .where('follower.email = :email', { email })
            .getCount();
    }

    async getFollowerList(email: string, page: number, limit: number): Promise<FollowListDto> {

        const query = this.createQueryBuilder('follow')
            .leftJoinAndSelect('follow.following', 'following')
            .leftJoinAndSelect('follow.follower', 'user')
            .where('following.email = :email', { email })
            .skip((page - 1) * limit)
            .take(limit);
        
        const [follows, total] = await query.getManyAndCount();
        
        const userList: UserInfoDto[] = follows.map((follow: Follow) => {
            const userInfo: UserInfoDto = new UserInfoDto();
            userInfo.email = follow.follower.email;
            userInfo.username = follow.follower.username;
            userInfo.thumbnail = follow.follower.thumbnail;
            userInfo.statusMessage = follow.follower.statusMessage;
            return userInfo;
        });

        return { follows: userList, total };
    }

    async getFollowingList(email: string, page: number, limit: number): Promise<FollowListDto> {

        const query = this.createQueryBuilder('follow')
            .leftJoinAndSelect('follow.follower', 'follower')
            .leftJoinAndSelect('follow.following', 'user')
            .where('follower.email = :email', { email })
            .skip((page - 1) * limit)
            .take(limit);
        
        const [follows, total] = await query.getManyAndCount();
        
        const userList: UserInfoDto[] = follows.map((follow: Follow) => {
            const userInfo: UserInfoDto = new UserInfoDto();
            userInfo.email = follow.following.email;
            userInfo.username = follow.following.username;
            userInfo.thumbnail = follow.following.thumbnail;
            userInfo.statusMessage = follow.following.statusMessage;
            return userInfo;
        });

        return { follows: userList, total };
    }

}