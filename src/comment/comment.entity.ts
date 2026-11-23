import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../user/user.entity';
import { CommentType } from './comment-type.enum';
import { PostEntity } from '../post/post.entity';

/**
 * A comment or reply row in the database (table "comment_entity").
 *
 * Comments and replies share this table:
 *   - COMMENT : written on a post        → parentCommentId is NULL
 *   - REPLY   : written on a comment     → parentCommentId is that comment's id
 *
 * What the API returns is a different shape (CommentInfoDto), produced by
 * comment.mapper.ts.
 */
@Entity()
export class CommentEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  content: string;

  @Column({ type: 'enum', enum: CommentType })
  type: CommentType;

  // For a reply: the id of the top-level comment it answers. NULL for comments.
  // The column type is written out because TypeORM cannot reliably infer it
  // from a `number | null` property (same reason as PostEntity.status).
  @Column({ type: 'integer', nullable: true })
  parentCommentId: number | null;

  // For a reply: the email of the parent comment's author (shown as "@name"
  // in the app). Copied from the parent by CommentService. NULL for comments.
  @Column({ type: 'varchar', nullable: true })
  parentCommentAuthor: string | null;

  // The parent comment of a REPLY (null for top-level comments).
  //
  // onDelete: 'CASCADE' → when a comment is deleted, PostgreSQL automatically
  // deletes all of its replies too.
  // Without it, deleting a comment that has replies failed with a foreign key
  // error (HTTP 500), because the replies still pointed at the deleted comment.
  // Covered by the e2e test "deletes a comment that has replies, together with its replies".
  @ManyToOne(() => CommentEntity, (comment) => comment.childComments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parentCommentId' })
  parentComment: CommentEntity;

  @OneToMany(() => CommentEntity, (comment) => comment.parentComment)
  childComments: CommentEntity[];

  // The post this comment (or reply) belongs to.
  //
  // onDelete: 'CASCADE' → when a post is deleted, PostgreSQL automatically
  // deletes all of its comments and replies too.
  // Without it, deleting a post that had comments failed with a foreign key
  // error (HTTP 500), because the comments still pointed at the deleted post.
  // Covered by the e2e test "deletes a post that has comments, together with its comments".
  @ManyToOne(() => PostEntity, (post) => post.comments, {
    eager: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn([{ name: 'postId', referencedColumnName: 'id' }])
  post: PostEntity;

  // The author of the comment.
  // (This used to name `user.posts` as its inverse side, which is the list of
  // POSTS, not comments. The inverse side is optional and no code navigates
  // from a user to their comments, so it is simply left out. Schema unchanged.)
  @ManyToOne(() => User, { eager: false })
  @JoinColumn([{ name: 'userEmail', referencedColumnName: 'email' }])
  user: User;

  @Column()
  createdAt: Date;

  @Column()
  updatedAt: Date;

  // NOT a database column. Filled in by CommentRepository (number of replies).
  childrenCount?: number;
}
