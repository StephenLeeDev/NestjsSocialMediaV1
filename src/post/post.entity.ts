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

  @Column('text', { array: true, nullable: false })
  likes: string[];

  @Column('text', { array: true, nullable: false })
  bookMarkedUsers: string[];

  @OneToMany(() => CommentEntity, (comment) => comment.post, { eager: true })
  @JoinColumn([{ name: 'commentId', referencedColumnName: 'id' }])
  comments: CommentEntity[];

  commentCount: number;
}
