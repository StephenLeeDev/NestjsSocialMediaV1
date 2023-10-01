import { MessageEntity } from "src/message/message.entity";
import { Follow } from "src/follow/follow.entity";
import { PostEntity } from "src/post/post.entity";
import { BaseEntity, Column, Entity, JoinColumn, OneToMany, Unique } from "typeorm";
import { UserChatRoomEntity } from "src/chatroom/user-chatroom.entity";

const serverUrl = 'http://192.168.1.251:3001'

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

    @OneToMany(() => PostEntity, post => post.user, { eager: true })
    @JoinColumn([{ name: 'postId', referencedColumnName: 'id' }])
    posts: PostEntity[];

    // @CreateDateColumn() // UTC
    @Column()
    createdAt: Date;

    @Column({ default: `${serverUrl}/images/default/dafault_thumbnail.png` })
    thumbnail: string;

    @Column('int', { array: true, nullable: false })
    bookMarks: number[];

    @Column({ default: "" })
    statusMessage: string;

    @OneToMany(() => UserChatRoomEntity, chatRoom => chatRoom.user)
    @JoinColumn([{ name: 'chatRoomId', referencedColumnName: 'id' }])
    userChatRooms: UserChatRoomEntity[];

    @OneToMany(() => MessageEntity, message => message.sender)
    messages: MessageEntity[];
  
    @OneToMany(() => Follow, follow => follow.follower)
    followings: Follow[];
  
    @OneToMany(() => Follow, follow => follow.following)
    followers: Follow[];
    
    totalPostCount: number;
    
    followerCount: number;
    
    followingCount: number;
    
}