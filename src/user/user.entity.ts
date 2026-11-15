import { MessageEntity } from '../message/message.entity';
import { Follow } from '../follow/follow.entity';
import { PostEntity } from '../post/post.entity';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { UserChatRoomEntity } from '../chatroom/user-chatroom.entity';

@Entity()
@Unique(['email'])
export class User extends BaseEntity {
  @Column({ primary: true })
  email: string;

  @Column()
  uuid: string;

  @Column()
  socialType: string;

  @Column()
  username: string;

  @OneToMany(() => PostEntity, (post) => post.user, { eager: true })
  @JoinColumn([{ name: 'postId', referencedColumnName: 'id' }])
  posts: PostEntity[];

  // @CreateDateColumn() // UTC
  @Column()
  createdAt: Date;

  // Full URL of the profile picture.
  // There is intentionally NO database default: the default picture's URL depends
  // on SERVER_URL, which is configuration, not schema. New accounts get it in
  // AuthRepository.createUser via defaultThumbnailUrl().
  @Column()
  thumbnail: string;

  @Column('int', { array: true, nullable: false })
  bookMarks: number[];

  @Column({ default: '' })
  statusMessage: string;

  @OneToMany(() => UserChatRoomEntity, (chatRoom) => chatRoom.user)
  @JoinColumn([{ name: 'chatRoomId', referencedColumnName: 'id' }])
  userChatRooms: UserChatRoomEntity[];

  @OneToMany(() => MessageEntity, (message) => message.sender)
  messages: MessageEntity[];

  @OneToMany(() => Follow, (follow) => follow.follower)
  followings: Follow[];

  @OneToMany(() => Follow, (follow) => follow.following)
  followers: Follow[];

  totalPostCount: number;

  followerCount: number;

  followingCount: number;
}
