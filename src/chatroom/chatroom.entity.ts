import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne } from 'typeorm';
import { MessageEntity } from '../message/message.entity';
import { UserChatRoomEntity } from './user-chatroom.entity';

@Entity()
export class ChatRoomEntity {

    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => MessageEntity, message => message.chatRoom)
    messages: MessageEntity[];

    @OneToMany(() => UserChatRoomEntity, chatRoom => chatRoom.chatRoom)
    userChatRooms: UserChatRoomEntity[];

    @Column()
    createdAt: Date;

    @Column()
    updatedAt: Date;

    latestMessage: MessageEntity;
}
