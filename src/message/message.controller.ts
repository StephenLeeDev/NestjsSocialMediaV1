import { Body, Controller, Get, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessageService } from './message.service';
import { MessageInfoDto, MessageInfoListDto } from './dto/message-info.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { GetUser } from 'src/auth/get-user.decorator';
import { User } from 'src/user/user.entity';

@ApiTags('MESSAGE')
@UseGuards(AuthGuard())
@ApiBearerAuth('Secret1234')
@Controller('message')
export class MessageController {

    constructor(
        private messageService: MessageService
    ) { }

    @ApiResponse({
        type: MessageInfoDto,
        status: 201,
        description: 'Success',
    })
    @ApiBody({ type: CreateMessageDto })
    @ApiOperation({ summary: `Create a new message` })
    @Post('/')
    createMessage(
        @Body() createMessageDto: CreateMessageDto,
        @GetUser() user: User,
    ): Promise<MessageInfoDto> {
        return this.messageService.createMessage(user, createMessageDto);
    }

    @ApiResponse({
        type: MessageInfoListDto,
        status: 200,
        description: 'Success',
    })
    @ApiQuery({
        name: 'chatRoomId',
        description: `The chat room ID`,
        required: true,
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
    @ApiOperation({ summary: `Get message list by chat room ID` })
    @Get('/')
    getMessageList(
        @Query('chatRoomId', ParseIntPipe) chatRoomId: number,
        @Query('page', ParseIntPipe) page: number,
        @Query('limit', ParseIntPipe) limit: number,
    ): Promise<MessageInfoListDto> {
        return this.messageService.getMessageList(chatRoomId, page, limit);
    }

}
