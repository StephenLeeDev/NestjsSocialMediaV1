import { EntityRepository, Repository } from "typeorm";
import { UserChatRoomEntity } from "./user-chatroom.entity";
import { User } from "src/user/user.entity";
import { ChatRoomEntity } from "./chatroom.entity";

@EntityRepository(UserChatRoomEntity)
export class UserChatRoomRepository extends Repository<UserChatRoomEntity> {

    async findChatRoomByParticipants(sender: User, receiver: User): Promise<ChatRoomEntity | null> {
        
        const query = this.createQueryBuilder('userChatRoomEntity')
            .leftJoinAndSelect('userChatRoomEntity.user', 'user')
            .leftJoinAndSelect('userChatRoomEntity.chatRoom', 'chatRoom')
            .where('user.email = :senderEmail OR user.email = :receiverEmail', { senderEmail: sender.email, receiverEmail: receiver.email })
            .groupBy('chatRoom.id')
            .addGroupBy('userChatRoomEntity.id')
            .addGroupBy('user.email');

        const userChatRooms = await query.getMany();

        for (const chatRoomEntity of userChatRooms) {
            const chatRoomId = chatRoomEntity.chatRoom.id;
            const senderParticipated = userChatRooms.some(userChat => userChat.user.email === sender.email && userChat.chatRoom.id === chatRoomId);
            const receiverParticipated = userChatRooms.some(userChat => userChat.user.email === receiver.email && userChat.chatRoom.id === chatRoomId);
            
            if (senderParticipated && receiverParticipated) {
                return chatRoomEntity.chatRoom;
            }
        }
    
        return null;
    }

}