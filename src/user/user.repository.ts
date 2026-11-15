/**
 * ============================================================================
 *  UserRepository: database access for users
 * ============================================================================
 *
 * Responsibility: talking to the database, and nothing else. What a profile
 * contains, who may see what, and how bookmarks are toggled is decided in
 * UserService.
 *
 * Besides the custom queries below, the standard TypeORM methods
 * (`findOneBy`, `update`, ...) are available because this class extends
 * `Repository<User>`.
 */
import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Follow } from '../follow/follow.entity';
import { PostStatus } from '../post/post-status.enum';
import { PostEntity } from '../post/post.entity';
import { User } from './user.entity';

/** The numbers shown on a profile. */
export interface ProfileCounts {
  /** The user's PUBLIC posts. */
  totalPostCount: number;
  /** Users who follow this user. */
  followerCount: number;
  /** Users this user follows. */
  followingCount: number;
}

/** Options for a username search. */
export interface UserSearchQuery {
  /** Text the username must contain ("" matches everyone). */
  keyword: string;
  /** This user is left out of the results (normally the person searching). */
  excludeEmail: string;
  /** 1-based page number. */
  page: number;
  /** Users per page. */
  limit: number;
}

@Injectable()
export class UserRepository extends Repository<User> {
  constructor(dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  /**
   * Counts the posts, followers and followings of a user.
   *
   * The three COUNT queries do not depend on each other, so they run in
   * parallel (`Promise.all`) instead of one after another.
   */
  async countProfileStats(email: string): Promise<ProfileCounts> {
    const follows = this.manager.getRepository(Follow);
    const posts = this.manager.getRepository(PostEntity);

    const [totalPostCount, followerCount, followingCount] = await Promise.all([
      posts.countBy({ user: { email }, status: PostStatus.PUBLIC }),
      // A Follow row means "follower → following".
      follows.countBy({ following: { email } }),
      follows.countBy({ follower: { email } }),
    ]);

    return { totalPostCount, followerCount, followingCount };
  }

  /**
   * Finds users whose username CONTAINS `keyword`, ordered by username.
   *
   * @returns `[users on this page, total number of matches]`
   */
  async searchByUsername({
    keyword,
    excludeEmail,
    page,
    limit,
  }: UserSearchQuery): Promise<[User[], number]> {
    return (
      this.createQueryBuilder('user')
        // `%...%` = "contains". The keyword itself is escaped (see below) so that
        // characters typed by the user are matched literally.
        .where(`user.username LIKE :pattern ESCAPE '\\'`, {
          pattern: `%${escapeLikePattern(keyword)}%`,
        })
        .andWhere('user.email <> :excludeEmail', { excludeEmail })
        // A fixed order is required for paging: without it the database may
        // return rows in any order, and pages could overlap or skip users.
        // email is the tie-breaker for equal usernames (it is unique).
        .orderBy('user.username', 'ASC')
        .addOrderBy('user.email', 'ASC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount()
    );
  }
}

/**
 * Escapes the special characters of SQL `LIKE` so they are matched literally:
 *   %  → normally "any number of characters"
 *   _  → normally "exactly one character"
 *   \  → the escape character itself
 *
 * Example: "50%_off" → "50\%\_off"
 *
 * This is NOT about SQL injection (the value is passed as a parameter, which
 * is already safe). It is about meaning: searching for "%" should find
 * usernames containing "%", not every user.
 */
function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}
