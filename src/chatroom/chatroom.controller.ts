import { Body, Controller, Get, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ChatRoomService } from './chatroom.service';
import { ChatRoomDto, ChatRoomListDto } from './dto/chatroom.dto';
import { GetUser } from 'src/auth/get-user.decorator';
import { User } from 'src/user/user.entity';
import { ReceiverEmailDto } from 'src/user/dto/receiver-email.dto';

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
    @ApiBody({ type: ReceiverEmailDto })
    @ApiOperation({ summary: `If a chat room with the receiver already exists, return the chat room information; if it doesn't exist, create and return the chat room` })
    @Post('/')
    createChatRoom(
        @GetUser() user: User,
        @Body() receiverEmailDto: ReceiverEmailDto,
    ): Promise<ChatRoomDto> {
        return this.chatService.createChatRoom(user, receiverEmailDto.email);
    }

    @ApiResponse({
        type: ChatRoomListDto,
        status: 200,
        description: 'Success',
    })
    @ApiQuery({
        name: 'page',
        description: `The page's number to call`,
        required: true,
    })
    @ApiQuery({
        name: 'limit',
        description: `The number of items on a single page`,
        required: true,
    })
    @ApiOperation({ summary: `Get chat room list by user` })
    @Get('/')
    getChatRoomList(
        @GetUser() user: User,
        @Query('page', ParseIntPipe) page: number,
        @Query('limit', ParseIntPipe) limit: number,
    ): Promise<ChatRoomListDto> {
        return this.chatService.getChatRoomList(user, page, limit);
    }

}
