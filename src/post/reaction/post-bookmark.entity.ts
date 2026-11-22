/**
 * ============================================================================
 *  PostBookmark: "this user saved this post" (table "post_bookmark")
 * ============================================================================
 *
 * A JOIN TABLE with the same shape as post_like (see post-like.entity.ts for
 * the general explanation):
 *
 *   user ──1──< post_bookmark >──1── post_entity
 *
 *   userEmail        │ postId │ createdAt
 *   ─────────────────┼────────┼────────────────────
 *   kate@gmail.com   │ 7      │ 2026-11-22 15:01
 *   mike@gmail.com   │ 7      │ 2026-11-22 15:03
 *
 * Before this table existed, every bookmark was stored TWICE: as a post id in
 * `user.bookMarks` and as an email in `post_entity.bookMarkedUsers`. The two
 * arrays could disagree (simultaneous requests overwrote the post's array),
 * and deleting a post left its id in users' arrays forever. Now a bookmark is
 * ONE row, and the database removes it together with the post or the user.
 *
 * `createdAt` also gives the "my bookmarks" list its order (most recently
 * saved first), which the old id array could not provide reliably.
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

@Entity('post_bookmark')
export class PostBookmark {
  // PRIMARY KEY (userEmail, postId): a post can be saved once per user.
  // Its first column also serves the "my bookmarks" list (WHERE userEmail = ?).
  @PrimaryColumn({ type: 'varchar' })
  userEmail: string;

  // Separate index for lookups by post (e.g. the cascade delete of a post).
  @PrimaryColumn({ type: 'integer' })
  @Index()
  postId: number;

  // When the post was saved (Seoul local time; see common/utils/date.util.ts).
  @Column({ type: 'timestamp' })
  createdAt: Date;

  // Only here to create the foreign keys (see post-like.entity.ts).
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userEmail', referencedColumnName: 'email' })
  user?: User;

  @ManyToOne(() => PostEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post?: PostEntity;
}
