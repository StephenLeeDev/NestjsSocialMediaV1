import { Injectable } from '@nestjs/common';
import { MessageRepository } from './message.repository';
import { ChatRoomRepository } from '../chatroom/chatroom.repository';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageInfoDto, MessageInfoListDto } from './dto/message-info.dto';
import { User } from '../user/user.entity';

@Injectable()
export class MessageService {
    constructor(
        private messageRepository: MessageRepository,
        private chatRoomRepository: ChatRoomRepository,
    ) { }

    async createMessage(sender: User, createMessageDto: CreateMessageDto): Promise<MessageInfoDto> {
        const { chatRoomId } = createMessageDto;
        const chatRoom = await this.chatRoomRepository.findOneBy({ id: Number(chatRoomId) });

        const message = await this.messageRepository.createMessage(sender, chatRoom, createMessageDto)
        chatRoom.updatedAt = message.createdAt;
        this.chatRoomRepository.save(chatRoom);

        return message;
    }

    async getMessageList(chatRoomId: number, page: number, limit: number): Promise<MessageInfoListDto> {
        return await this.messageRepository.getMessageList(chatRoomId, page, limit);
    }

}
