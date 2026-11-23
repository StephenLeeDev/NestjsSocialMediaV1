import { Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../user/user.entity';

/**
 * One "follow" relationship: `follower` follows `following`.
 * (Table "follow", columns "followerEmail" and "followingEmail".)
 *
 * Example: if Fan follows Star, there is one row
 *   { follower: Fan, following: Star }
 * so Star's followers are the rows WHERE following = Star, and Fan's
 * followings are the rows WHERE follower = Fan.
 *
 * Database guarantees (added during the follow module refactor):
 *   - Both sides are required (NOT NULL). Following an unknown user used to
 *     store a row whose "followingEmail" was NULL.
 *   - The pair (follower, following) is UNIQUE, so the same follow can never
 *     be stored twice, even when two requests arrive at the same moment.
 *     FollowRepository inserts with ON CONFLICT DO NOTHING on top of this.
 */
@Entity()
@Unique('UQ_follow_follower_following', ['follower', 'following'])
export class Follow {
  @PrimaryGeneratedColumn()
  id: number;

  // The user who follows.
  @ManyToOne(() => User, (user) => user.followings, { nullable: false })
  follower: User;

  // The user who is followed.
  @ManyToOne(() => User, (user) => user.followers, { nullable: false })
  following: User;
}
