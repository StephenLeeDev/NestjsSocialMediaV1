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

@Entity()
export class CommentEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  content: string;

  @Column({ type: 'enum', enum: CommentType })
  type: CommentType;

  @Column({ nullable: true })
  parentCommentId: number;

  @Column({ nullable: true })
  parentCommentAuthor: string;

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

  @ManyToOne(() => User, (user) => user.posts, { eager: false })
  @JoinColumn([{ name: 'userEmail', referencedColumnName: 'email' }])
  user: User;

  @Column()
  createdAt: Date;

  @Column()
  updatedAt: Date;

  childrenCount: number;
}
