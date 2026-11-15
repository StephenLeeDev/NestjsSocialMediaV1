import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { ChatRoomEntity } from '../chatroom/chatroom.entity';
import { User } from '../user/user.entity';
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

  // The DB column type is written out explicitly ('varchar') instead of being
  // inferred from the TypeScript type `MessageType`.
  //   - Without it, TypeORM guesses the column type from the type information
  //     TypeScript emits for decorators ("reflection metadata").
  //   - For an enum, that information is only correct when the whole project is
  //     compiled together (`nest build`). Tools that compile one file at a time,
  //     such as ts-jest in the e2e tests, emit `Object`, and TypeORM then fails
  //     with "Data type Object is not supported".
  //   - 'varchar' is exactly what the column already was, so the database schema
  //     does not change. Values are 'TEXT' / 'IMAGE' (see message-type.ts).
  @Column({ type: 'varchar' })
  type: MessageType;

}