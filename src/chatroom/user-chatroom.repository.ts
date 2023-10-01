import { EntityRepository, Repository } from "typeorm";
import { UserChatRoomEntity } from "./user-chatroom.entity";
import { User } from "src/user/user.entity";
import { ChatRoomEntity } from "./chatroom.entity";
import { ChatRoomDto, ChatRoomListDto } from "./dto/chatroom.dto";
import { MessageEntity } from "src/message/message.entity";

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

    async getChatRoomList(user: User, page: number, limit: number): Promise<ChatRoomListDto> {
        const query = this.createQueryBuilder('userChatRoomEntity')
            .leftJoinAndSelect('userChatRoomEntity.user', 'user')
            .leftJoinAndSelect('userChatRoomEntity.chatRoom', 'chatRoom')
            .where('user.email = :userEmail', { userEmail: user.email })
            .groupBy('chatRoom.id, message.id')
            .groupBy('chatRoom.id')
            .addGroupBy('userChatRoomEntity.id')
            .addGroupBy('user.email')
            .orderBy('chatRoom.updatedAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        const [list, total] = await query.getManyAndCount();

        const chatRooms: ChatRoomEntity[] = list.map(userChatRoom => userChatRoom.chatRoom);

        const chatRoomList: ChatRoomDto[] = chatRooms.map((item: ChatRoomEntity) => {
            const chatRoomInfo: ChatRoomDto = new ChatRoomDto();
            chatRoomInfo.id = item.id;
            chatRoomInfo.participants;
            chatRoomInfo.createdAt = item.createdAt;
            chatRoomInfo.updatedAt = item.updatedAt;
            return chatRoomInfo;
        });
      
        return { list: chatRoomList, total };
    }
    
    async findChatPartnerByChatRoomId(chatRoomId: number, user: User): Promise<User> {
        const userChatRoom = await this.createQueryBuilder('userChatRoom')
            .leftJoinAndSelect('userChatRoom.user', 'user')
            .where('userChatRoom.chatRoomId = :chatRoomId', { chatRoomId })
            .andWhere('user.email != :userEmail', { userEmail: user.email })
            .getOne();

        return userChatRoom.user;
    }

    async findParticipantsByChatRoomId(chatRoomId: number): Promise<User[]> {
        const userChatRooms = await this.createQueryBuilder('userChatRoom')
            .leftJoinAndSelect('userChatRoom.user', 'user')
            .where('userChatRoom.chatRoomId = :chatRoomId', { chatRoomId })
            .getMany();

        return userChatRooms.map(userChatRoom => userChatRoom.user);
    }

}