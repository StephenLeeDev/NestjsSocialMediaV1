import { EntityRepository, Repository } from "typeorm";
import * as moment from 'moment-timezone';
import { MessageEntity } from "./message.entity";
import { User } from "src/user/user.entity";
import { MessageInfoDto, MessageInfoListDto } from "./dto/message-info.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { ChatRoomEntity } from "src/chatroom/chatroom.entity";
import { UserSimpleInfoIncludingStatusMessageDto } from "src/user/dto/user-simple-info-including-status-message.dto";

@EntityRepository(MessageEntity)
export class MessageRepository extends Repository<MessageEntity> {

    async createMessage(sender: User, chatRoom: ChatRoomEntity, createMessageDto: CreateMessageDto): Promise<MessageInfoDto> {
        
        const { content, type } = createMessageDto;

        const createdAt = moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss.SSS'); // You can set your time zone here
        const now = new Date(createdAt);
        
        const message = this.create({
            content,
            chatRoom,
            type: type,
            sender,
            createdAt: now,
            updatedAt: now,
        });
    
        await this.save(message);

        var created = new MessageInfoDto();
        created.id = message.id;
        created.content = message.content;
        created.type = message.type;
        created.sender = new UserSimpleInfoIncludingStatusMessageDto();
        created.sender.email = message.sender.email;
        created.sender.thumbnail = message.sender.thumbnail;
        created.sender.username = message.sender.username;
        created.sender.statusMessage = message.sender.statusMessage;
        created.createdAt = message.createdAt;
        created.updatedAt = message.updatedAt;

        return created;
    }

    async getMessageList(chatRoomId: number, page: number, limit: number): Promise<MessageInfoListDto> {
        const query = this.createQueryBuilder('messages')
            .leftJoinAndSelect('messages.sender', 'user')
            .where('messages.chatRoomId = :chatRoomId', { chatRoomId })
            .orderBy('messages.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);
      
        const [messages, total] = await query.getManyAndCount();
      
        const messageList: MessageInfoDto[] = messages.map((message: MessageEntity) => {
            const messageInfo: MessageInfoDto = new MessageInfoDto();
            messageInfo.id = message.id;
            messageInfo.content = message.content;
            messageInfo.type = message.type;
            messageInfo.sender = new UserSimpleInfoIncludingStatusMessageDto();
            messageInfo.sender.email = message.sender.email;
            messageInfo.sender.thumbnail = message.sender.thumbnail;
            messageInfo.sender.username = message.sender.username;
            messageInfo.sender.statusMessage = message.sender.statusMessage;
            messageInfo.createdAt = message.createdAt;
            messageInfo.updatedAt = message.updatedAt;
            return messageInfo;
        });
      
        return { messages: messageList, total };
    }
    
    async findLastMessageByChatRoomId(chatRoomId: number): Promise<string> {
        const latestMessage = await this.createQueryBuilder('messages')
            .where('messages.chatRoomId = :chatRoomId', { chatRoomId })
            .orderBy('messages.createdAt', 'DESC')
            .take(1)
            .getOne();
        
        return latestMessage?.content ?? "";
    }
}