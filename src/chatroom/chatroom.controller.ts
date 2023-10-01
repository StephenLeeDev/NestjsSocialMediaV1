import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ChatRoomService } from './chatroom.service';
import { ChatRoomDto } from './dto/chatroom.dto';
import { GetUser } from 'src/auth/get-user.decorator';
import { User } from 'src/user/user.entity';

@ApiTags('CHAT')
@UseGuards(AuthGuard())
@ApiBearerAuth('Secret1234')
@Controller('chat')
export class ChatRoomController {

    constructor(
        private chatService: ChatRoomService
    ) { }

    @ApiResponse({
        type: ChatRoomDto,
        status: 201,
        description: 'Success',
    })
    @ApiQuery({
        name: 'receiver',
        description: `The receiver's email address`,
        required: true,
    })
    @ApiOperation({ summary: `If a chat room with the receiver already exists, return the chat room information; if it doesn't exist, create and return the chat room` })
    @Post('/')
    createComment(
        @GetUser() user: User,
        @Query('receiver') receiver: string,
    ): Promise<ChatRoomDto> {
        return this.chatService.createChatRoom(user, receiver);
    }

}
