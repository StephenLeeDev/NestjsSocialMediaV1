import { User } from '../user/user.entity';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PostStatus } from './post-status.enum';
import { CommentEntity } from '../comment/comment.entity';

/**
 * A post row in the database (table "post_entity").
 *
 * This class describes how posts are STORED. What the API returns is a
 * different shape (PostInfoDto), produced by post.mapper.ts.
 */
@Entity()
export class PostEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  description: string;

  // The DB column type is written out explicitly ('varchar') instead of being
  // inferred from the TypeScript type `PostStatus`.
  //   - Without it, TypeORM guesses the column type from the type information
  //     TypeScript emits for decorators ("reflection metadata").
  //   - For an enum, that information is only correct when the whole project is
  //     compiled together (`nest build`). Tools that compile one file at a time,
  //     such as ts-jest in the e2e tests, emit `Object`, and TypeORM then fails
  //     with "Data type Object is not supported".
  //   - 'varchar' is exactly what the column already was, so the database schema
  //     does not change. Values are 'PUBLIC' / 'PRIVATE' (see post-status.enum.ts).
  @Column({ type: 'varchar' })
  status: PostStatus;

  @ManyToOne(() => User, (user) => user.posts, { eager: false })
  @JoinColumn([{ name: 'userEmail', referencedColumnName: 'email' }])
  user: User;

  @Column()
  createdAt: Date;

  @Column()
  updatedAt: Date;

  @Column('text', { array: true, nullable: false })
  imageUrls: string[];

  // Emails of the users who liked this post (a PostgreSQL text[] column).
  @Column('text', { array: true, nullable: false })
  likes: string[];

  // Emails of the users who bookmarked this post.
  @Column('text', { array: true, nullable: false })
  bookMarkedUsers: string[];

  // The comments and replies of this post (the other side of CommentEntity.post).
  //
  // Not `eager` anymore: eager loading fetched EVERY comment of the post on
  // every lookup (e.g. each like), although no code reads this list. Comment
  // counts are computed with one COUNT query in PostRepository instead.
  // (The `@JoinColumn` that used to be here had no effect: the foreign key
  // column lives on the comment side.) The database schema is unchanged.
  @OneToMany(() => CommentEntity, (comment) => comment.post)
  comments: CommentEntity[];

  // NOT a database column. Filled in by PostRepository.attachCommentCounts.
  commentCount?: number;
}
