/**
 * ============================================================================
 *  PostLike: "this user likes this post" (table "post_like")
 * ============================================================================
 *
 * A JOIN TABLE: one row per (user, post) pair, the standard way to store a
 * many-to-many relationship (a user likes many posts, a post is liked by many
 * users). The `follow` table works the same way.
 *
 *   user ──1──< post_like >──1── post_entity
 *
 *   userEmail        │ postId │ createdAt
 *   ─────────────────┼────────┼────────────────────
 *   kate@gmail.com   │ 7      │ 2026-11-22 15:02
 *
 * Before this table existed, likes were stored as an array of emails inside
 * the post row (`post_entity.likes`). Every like read the whole array, added
 * an email and wrote the whole array back, so two likes at the same moment
 * overwrote each other (only 2 to 4 of 20 simultaneous likes survived).
 * With one row per like, liking is a single INSERT and unliking a single
 * DELETE, which the database handles safely in parallel.
 *
 * What the database now guarantees by itself:
 *   - PRIMARY KEY (userEmail, postId) → a user can like a post only once
 *   - FOREIGN KEYs with ON DELETE CASCADE → deleting a post (or a user)
 *     deletes its likes, so no like can point to something that is gone
 */
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../user/user.entity';
import { PostEntity } from '../post.entity';

@Entity('post_like')
export class PostLike {
  // The two columns together form the primary key, so the same pair can
  // never be stored twice. (No separate auto-increment id is needed.)
  // The key's first column also serves "all likes of a user" lookups.
  @PrimaryColumn({ type: 'varchar' })
  userEmail: string;

  // Separate index for "all likes of a post" (counting likes for the feed).
  // The primary key index cannot serve that, because postId is its SECOND
  // column.
  @PrimaryColumn({ type: 'integer' })
  @Index()
  postId: number;

  // When the like was given (Seoul local time, like every stored timestamp;
  // see common/utils/date.util.ts).
  @Column({ type: 'timestamp' })
  createdAt: Date;

  // The relations only exist to create the foreign keys. The code works with
  // the plain `userEmail` / `postId` columns above.
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userEmail', referencedColumnName: 'email' })
  user?: User;

  @ManyToOne(() => PostEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post?: PostEntity;
}
