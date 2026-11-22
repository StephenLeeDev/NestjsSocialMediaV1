/**
 * ============================================================================
 *  FollowRepository: database access for follow relationships
 * ============================================================================
 *
 * Responsibility: talking to the database, and nothing else. Rules such as
 * "you cannot follow yourself" or "the user must exist" live in FollowService.
 *
 * A Follow row means "follower → following" (see follow.entity.ts):
 *   - someone's FOLLOWERS  = rows WHERE following = them
 *   - someone's FOLLOWINGS = rows WHERE follower  = them
 */
import { Injectable } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { User } from '../user/user.entity';
import { Follow } from './follow.entity';

@Injectable()
export class FollowRepository extends Repository<Follow> {
  constructor(dataSource: DataSource) {
    super(Follow, dataSource.createEntityManager());
  }

  // ==========================================================================
  //  Single relationship
  // ==========================================================================

  /** Whether `followerEmail` follows `followingEmail`. */
  async isFollowing(
    followerEmail: string,
    followingEmail: string,
  ): Promise<boolean> {
    // `existsBy` stops at the first matching row (no need to count them all).
    return this.existsBy({
      follower: { email: followerEmail },
      following: { email: followingEmail },
    });
  }

  /**
   * Stores "follower → following" unless it already exists.
   *
   * `ON CONFLICT DO NOTHING` (TypeORM: `.orIgnore()`) makes the database skip
   * the insert when the unique (follower, following) constraint would be
   * broken. That is atomic: even two requests at the same moment cannot
   * create a duplicate, and following someone twice is simply harmless.
   */
  async insertIfMissing(
    followerEmail: string,
    followingEmail: string,
  ): Promise<void> {
    await this.createQueryBuilder()
      .insert()
      .into(Follow)
      // Only the keys are needed to link the two existing users.
      .values({
        follower: { email: followerEmail },
        following: { email: followingEmail },
      })
      .orIgnore()
      .execute();
  }

  /** Removes "follower → following". Removing a missing follow is a no-op. */
  async deleteFollow(
    followerEmail: string,
    followingEmail: string,
  ): Promise<void> {
    await this.createQueryBuilder()
      .delete()
      .from(Follow)
      // DELETE statements cannot join, so the foreign key columns are used
      // directly. Their names come from TypeORM's naming: relation name +
      // primary key of User ("follower" + "Email").
      .where('"followerEmail" = :followerEmail', { followerEmail })
      .andWhere('"followingEmail" = :followingEmail', { followingEmail })
      .execute();
  }

  // ==========================================================================
  //  Counts
  // ==========================================================================

  /** How many users follow `email`. */
  async countFollowers(email: string): Promise<number> {
    return this.countBy({ following: { email } });
  }

  /** How many users `email` follows. */
  async countFollowings(email: string): Promise<number> {
    return this.countBy({ follower: { email } });
  }

  // ==========================================================================
  //  Lists (newest follow first)
  // ==========================================================================

  /**
   * One page of the users who follow `email`.
   *
   * @returns `[users on this page, total number of followers]`
   */
  async findFollowersPage(
    email: string,
    page: number,
    limit: number,
  ): Promise<[User[], number]> {
    // Join the FOLLOWER side and keep the rows where `email` is followed.
    return this.findUsersPage('follower', 'following', email, page, limit);
  }

  /**
   * One page of the users that `email` follows.
   *
   * @returns `[users on this page, total number of followings]`
   */
  async findFollowingsPage(
    email: string,
    page: number,
    limit: number,
  ): Promise<[User[], number]> {
    // Join the FOLLOWING side and keep the rows where `email` is the follower.
    return this.findUsersPage('following', 'follower', email, page, limit);
  }

  // ==========================================================================
  //  Internal helpers
  // ==========================================================================

  /**
   * Shared query for both lists.
   *
   * @param listedSide The side whose users are returned.
   * @param fixedSide  The side that must be `email`.
   */
  private async findUsersPage(
    listedSide: 'follower' | 'following',
    fixedSide: 'follower' | 'following',
    email: string,
    page: number,
    limit: number,
  ): Promise<[User[], number]> {
    const query: SelectQueryBuilder<Follow> = this.createQueryBuilder('follow')
      .innerJoin(`follow.${listedSide}`, 'listed')
      .innerJoin(`follow.${fixedSide}`, 'fixed')
      // Only the columns shown in user lists (no bookmarks or other private data).
      .select([
        'follow.id',
        'listed.email',
        'listed.username',
        'listed.thumbnail',
        'listed.statusMessage',
      ])
      .where('fixed.email = :email', { email })
      // The follow table has no timestamp, but ids grow with every insert, so
      // the highest id is the newest follow. A fixed order is required for
      // paging; without it the database may return rows in any order.
      .orderBy('follow.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [follows, total] = await query.getManyAndCount();
    return [follows.map((follow) => follow[listedSide]), total];
  }
}
