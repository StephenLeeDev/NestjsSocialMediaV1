import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { MessageEntity } from '../message/message.entity';
import { UserChatRoomEntity } from './user-chatroom.entity';

/**
 * A direct-message chat room (table "chat_room_entity").
 *
 * Who is in a room is stored in UserChatRoomEntity (one row per participant);
 * the messages are MessageEntity rows pointing at the room.
 *
 * `updatedAt` is moved forward whenever a message is sent, so the room list
 * can show the most recently active rooms first.
 */
@Entity()
export class ChatRoomEntity {
  @PrimaryGeneratedColumn()
  id: number;

  // The room's messages (the other side of MessageEntity.chatRoom).
  //
  // This used to be declared as @ManyToOne by mistake, which made TypeORM add a
  // meaningless "messagesId" column to this table. As a one-to-many relation it
  // needs no column here (the foreign key lives on the message). The stray
  // column was dropped by `synchronize` back then; databases built by the
  // migrations (src/migrations) never had it.
  @OneToMany(() => MessageEntity, (message) => message.chatRoom)
  messages: MessageEntity[];

  // One row per participant (always two for a direct message).
  @OneToMany(() => UserChatRoomEntity, (membership) => membership.chatRoom)
  userChatRooms: UserChatRoomEntity[];

  @Column()
  createdAt: Date;

  // Last activity: creation, or the newest message.
  @Column()
  updatedAt: Date;
}
