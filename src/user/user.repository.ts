import { DataSource, Repository } from 'typeorm';
import { User } from './user.entity';
import { UserInfoDto } from './dto/user-info.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Follow } from '../follow/follow.entity';
import { bookMarksDTO } from './dto/book-marks.dto';
import { UpdatedUserThumbnailDto } from './dto/updated-user-thumbnail.dto';
import { PostStatus } from '../post/post-status.enum';
import { UserListDto } from './dto/user-list.dto';
import { UserSimpleInfoIncludingStatusMessageDto } from './dto/user-simple-info-including-status-message.dto';

@Injectable()
export class UserRepository extends Repository<User> {
  constructor(dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  async getUserInfo(email: string): Promise<UserInfoDto> {
    const user = await this.createQueryBuilder('user')
      .where('user.email = :email', { email })
      .select([
        'user.email',
        'user.username',
        'user.thumbnail',
        'user.bookMarks',
        'user.statusMessage',
      ])
      .getOne();

    // `loadRelationCountAndMap` was removed in TypeORM 1.0, so count follows explicitly.
    const followRepository = this.manager.getRepository(Follow);
    const [followerCount, followingCount] = await Promise.all([
      followRepository.countBy({ following: { email } }),
      followRepository.countBy({ follower: { email } }),
    ]);

    const post = this.createQueryBuilder('user')
      .where('user.email = :email', { email })
      .leftJoinAndSelect('user.posts', 'post', 'post.status = :status', {
        status: PostStatus.PUBLIC,
      })
      .select('COUNT(post.id)', 'totalPostCount');

    const [{ totalPostCount }] = await post.getRawMany();

    if (user) {
      const userInfo: UserInfoDto = new UserInfoDto();
      userInfo.email = user.email;
      userInfo.username = user.username;
      userInfo.thumbnail = user.thumbnail;
      userInfo.bookMarks = user.bookMarks;
      userInfo.statusMessage = user.statusMessage;
      userInfo.totalPostCount = isNaN(parseInt(totalPostCount, 10))
        ? 0
        : parseInt(totalPostCount, 10);
      userInfo.followerCount = followerCount;
      userInfo.followingCount = followingCount;
      return userInfo;
    } else {
      throw new NotFoundException(`User not found`);
    }
  }

  async postBookMark(email: string, postId: number): Promise<bookMarksDTO> {
    const user = await this.findOneBy({ email });

    if (!user) {
      throw new Error('User not found');
    }

    let { bookMarks } = user;

    // If it was previously bookmarked, cancel the bookmark
    if (bookMarks.includes(postId)) {
      bookMarks = bookMarks.filter((id) => id !== postId);
    }
    // If it hadn't been bookmarked yet, proceed with bookmarking.
    else {
      bookMarks.push(postId);
    }
    user.bookMarks = bookMarks;
    await this.save(user);

    return { bookMarks };
  }

  async updateUserThumbnail(
    email: string,
    newThumbnailUrl: string,
  ): Promise<UpdatedUserThumbnailDto> {
    const user = await this.findOneBy({ email });

    if (!user) {
      throw new Error('User not found');
    }

    user.thumbnail = newThumbnailUrl;
    await this.save(user);

    const updatedUserThumbnailDto = new UpdatedUserThumbnailDto();
    updatedUserThumbnailDto.updatedThumbnail = user.thumbnail;

    return updatedUserThumbnailDto;
  }

  async deleteThumbnail(user: User): Promise<UpdatedUserThumbnailDto> {
    const defaultThumbnail =
      'http://192.168.1.251:3001/images/default/dafault_thumbnail.png';
    user.thumbnail = defaultThumbnail;
    await this.save(user);

    const updatedUserThumbnailDto = new UpdatedUserThumbnailDto();
    updatedUserThumbnailDto.updatedThumbnail = user.thumbnail;

    return updatedUserThumbnailDto;
  }

  async updateStatusMessage(
    email: string,
    newStatusMessage: string,
  ): Promise<void> {
    const user = await this.findOneBy({ email });

    if (user) {
      /// Update user status message
      user.statusMessage = newStatusMessage;
      await this.save(user);
    } else {
      throw new NotFoundException(`User not found`);
    }
  }

  async getUserListByKeyword(
    user: User,
    keyword: string,
    page: number,
    limit: number,
  ): Promise<UserListDto> {
    const email = user.email;
    const query = this.createQueryBuilder('user')
      .where('user.username LIKE :keyword', { keyword: `%${keyword}%` })
      .andWhere('user.email <> :email', { email })
      .skip((page - 1) * limit)
      .take(limit);

    const [users, total] = await query.getManyAndCount();

    const userList: UserSimpleInfoIncludingStatusMessageDto[] = users.map(
      (user: User) => {
        const userInfo: UserSimpleInfoIncludingStatusMessageDto =
          new UserSimpleInfoIncludingStatusMessageDto();
        userInfo.email = user.email;
        userInfo.username = user.username;
        userInfo.thumbnail = user.thumbnail;
        userInfo.statusMessage = user.statusMessage;
        return userInfo;
      },
    );

    return { userList, total };
  }
}
