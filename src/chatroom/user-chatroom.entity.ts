import { Entity, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from 'src/user/user.entity';
import { ChatRoomEntity } from './chatroom.entity';

@Entity()
export class UserChatRoomEntity {

    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, user => user.userChatRooms)
    user: User;

    @ManyToOne(() => ChatRoomEntity, chatRoom => chatRoom.userChatRooms)
    chatRoom: ChatRoomEntity;

}
