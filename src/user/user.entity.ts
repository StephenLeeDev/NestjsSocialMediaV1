import { MessageEntity } from '../message/message.entity';
import { Follow } from '../follow/follow.entity';
import { PostEntity } from '../post/post.entity';
import { BaseEntity, Column, Entity, OneToMany, Unique } from 'typeorm';
import { UserChatRoomEntity } from '../chatroom/user-chatroom.entity';

/**
 * A user row in the database (table "user"). The email is the primary key.
 *
 * What the API returns about a user is decided by user.mapper.ts and
 * UserService (profiles); this class only describes how users are STORED.
 */
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

  // The user's posts (the other side of PostEntity.user).
  //
  // Not `eager` anymore: the JWT guard loads the signed-in user on EVERY
  // request, and eager loading made that also load ALL of the user's posts
  // each time, although no code reads this list. (The `@JoinColumn` that was
  // here had no effect on a one-to-many relation.) Schema unchanged.
  @OneToMany(() => PostEntity, (post) => post.user)
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

  // IDs of the posts this user bookmarked (private; see UserService.toggleBookmark).
  @Column('int', { array: true, nullable: false })
  bookMarks: number[];

  @Column({ default: '' })
  statusMessage: string;

  @OneToMany(() => UserChatRoomEntity, (chatRoom) => chatRoom.user)
  userChatRooms: UserChatRoomEntity[];

  @OneToMany(() => MessageEntity, (message) => message.sender)
  messages: MessageEntity[];

  // Follow rows where this user is the FOLLOWER (= the people they follow).
  @OneToMany(() => Follow, (follow) => follow.follower)
  followings: Follow[];

  // Follow rows where this user is FOLLOWED (= their followers).
  @OneToMany(() => Follow, (follow) => follow.following)
  followers: Follow[];

  // (The non-column fields totalPostCount / followerCount / followingCount that
  // used to be here were never filled in on the entity; profile counts are
  // computed by UserRepository.countProfileStats.)
}
