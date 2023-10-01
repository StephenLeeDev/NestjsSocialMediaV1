import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { ChatRoomEntity } from '../chatroom/chatroom.entity';
import { User } from 'src/user/user.entity';
import { MessageType } from './message-type';

@Entity('messages')
export class MessageEntity {
    
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  content: string;

  @ManyToOne(() => ChatRoomEntity, (chatRoom) => chatRoom.messages)
  chatRoom: ChatRoomEntity;

  @ManyToOne(() => User, (user) => user.messages)
  sender: User;

  @Column()
  createdAt: Date;

  @Column()
  updatedAt: Date;

  @Column()
  type: MessageType;

}