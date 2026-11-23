import { Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../user/user.entity';
import { ChatRoomEntity } from './chatroom.entity';

/**
 * Membership: "this user takes part in this chat room"
 * (table "user_chat_room_entity", columns "userEmail" and "chatRoomId").
 *
 * A direct-message room has exactly two of these rows. "Is X allowed to read
 * or write in room R?" is answered by looking for the row (X, R).
 *
 * Database guarantees (added during the chat module refactor):
 *   - both columns are required (NOT NULL)
 *   - the same user cannot be in the same room twice (UNIQUE)
 *   - deleting a room deletes its memberships (ON DELETE CASCADE)
 */
@Entity()
@Unique('UQ_user_chat_room_user_room', ['user', 'chatRoom'])
export class UserChatRoomEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.userChatRooms, { nullable: false })
  user: User;

  @ManyToOne(() => ChatRoomEntity, (chatRoom) => chatRoom.userChatRooms, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  chatRoom: ChatRoomEntity;
}
