/**
 * ============================================================================
 *  FollowService: the business rules for following users
 * ============================================================================
 *
 * Layering (same pattern as the other modules):
 *
 *   FollowController  → HTTP only
 *        │
 *   FollowService     → rules (THIS FILE)
 *        │                - the user to follow must exist (404)
 *        │                - you cannot follow yourself (400)
 *        │                - following / unfollowing twice is harmless
 *        │
 *   FollowRepository  → database queries only
 *
 * Exported by FollowModule: UserService uses `isFollowing` for profiles.
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserListDto } from '../user/dto/user-list.dto';
import { User } from '../user/user.entity';
import { toUserSummaryDto } from '../user/user.mapper';
import { UserRepository } from '../user/user.repository';
import { SingleIntegerDto } from './dto/single-integer.dto';
import { FollowRepository } from './follow.repository';

@Injectable()
export class FollowService {
  constructor(
    private readonly followRepository: FollowRepository,
    // Only used to check that the user to follow exists.
    private readonly userRepository: UserRepository,
  ) {}

  // ==========================================================================
  //  Follow / unfollow
  // ==========================================================================

  /**
   * The viewer follows `targetEmail`. Following someone you already follow
   * changes nothing (no duplicate is stored).
   *
   * @returns The target's follower count AFTER the change.
   * @throws BadRequestException (400) when following yourself.
   * @throws NotFoundException   (404) when the target user does not exist.
   *         (Previously this stored a follow row pointing at NULL.)
   */
  async follow(viewer: User, targetEmail: string): Promise<SingleIntegerDto> {
    if (targetEmail === viewer.email) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const targetExists = await this.userRepository.existsBy({
      email: targetEmail,
    });
    if (!targetExists) {
      throw new NotFoundException(`User not found`);
    }

    await this.followRepository.insertIfMissing(viewer.email, targetEmail);

    return SingleIntegerDto.of(
      await this.followRepository.countFollowers(targetEmail),
    );
  }

  /**
   * The viewer stops following `targetEmail`. Unfollowing someone you do not
   * follow (or an unknown user) changes nothing.
   *
   * @returns The target's follower count AFTER the change.
   */
  async unfollow(viewer: User, targetEmail: string): Promise<SingleIntegerDto> {
    await this.followRepository.deleteFollow(viewer.email, targetEmail);

    return SingleIntegerDto.of(
      await this.followRepository.countFollowers(targetEmail),
    );
  }

  // ==========================================================================
  //  Read
  // ==========================================================================

  /** Whether `viewerEmail` follows `targetEmail`. */
  async isFollowing(
    viewerEmail: string,
    targetEmail: string,
  ): Promise<boolean> {
    return this.followRepository.isFollowing(viewerEmail, targetEmail);
  }

  /** How many users follow `email`. */
  async countFollowers(email: string): Promise<number> {
    return this.followRepository.countFollowers(email);
  }

  /** How many users `email` follows. */
  async countFollowings(email: string): Promise<number> {
    return this.followRepository.countFollowings(email);
  }

  /** One page of the users who follow `email`, newest follower first. */
  async getFollowers(
    email: string,
    page: number,
    limit: number,
  ): Promise<UserListDto> {
    const [users, total] = await this.followRepository.findFollowersPage(
      email,
      page,
      limit,
    );
    return { userList: users.map(toUserSummaryDto), total };
  }

  /** One page of the users `email` follows, newest follow first. */
  async getFollowings(
    email: string,
    page: number,
    limit: number,
  ): Promise<UserListDto> {
    const [users, total] = await this.followRepository.findFollowingsPage(
      email,
      page,
      limit,
    );
    return { userList: users.map(toUserSummaryDto), total };
  }
}
