import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MessageRepository } from './message.repository';
import { ChatRoomRepository } from 'src/chatroom/chatroom.repository';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageInfoDto, MessageInfoListDto } from './dto/message-info.dto';
import { User } from 'src/user/user.entity';

@Injectable()
export class MessageService {
    constructor(
        @InjectRepository(MessageRepository)
        private messageRepository: MessageRepository,
        @InjectRepository(ChatRoomRepository)
        private chatRoomRepository: ChatRoomRepository,
    ) { }

    async createMessage(sender: User, createMessageDto: CreateMessageDto): Promise<MessageInfoDto> {
        const { chatRoomId } = createMessageDto;
        const chatRoom = await this.chatRoomRepository.findOne(chatRoomId);

        const message = await this.messageRepository.createMessage(sender, chatRoom, createMessageDto)
        chatRoom.updatedAt = message.createdAt;
        this.chatRoomRepository.save(chatRoom);

        return message;
    }

    async getMessageList(chatRoomId: number, page: number, limit: number): Promise<MessageInfoListDto> {
        return await this.messageRepository.getMessageList(chatRoomId, page, limit);
    }

}
