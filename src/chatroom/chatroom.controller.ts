/**
 * ============================================================================
 *  ChatRoomController: HTTP endpoints for direct-message rooms (/chat)
 * ============================================================================
 *
 * Responsibility: HTTP only (routes, parsing, Swagger). Every rule lives in
 * ChatRoomService. All routes require a signed-in user.
 *
 * Real-time delivery of messages is handled by ChatGateway (Socket.IO).
 */
import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '../auth/get-user.decorator';
import { ReceiverEmailDto } from '../user/dto/receiver-email.dto';
import { User } from '../user/user.entity';
import { ChatRoomService } from './chatroom.service';
import { ChatRoomDto, ChatRoomListDto } from './dto/chatroom.dto';

@ApiTags('CHAT')
@UseGuards(AuthGuard())
@ApiBearerAuth('Secret1234')
@Controller('chat')
export class ChatRoomController {
  constructor(private readonly chatRoomService: ChatRoomService) {}

  @ApiOperation({
    summary: `Open the chat room with another user (returns the existing room if there is one)`,
  })
  @ApiBody({ type: ReceiverEmailDto })
  @ApiResponse({ type: ChatRoomDto, status: 201, description: 'Success' })
  @Post('/')
  openRoom(
    @GetUser() user: User,
    @Body() receiverEmailDto: ReceiverEmailDto,
  ): Promise<ChatRoomDto> {
    return this.chatRoomService.openRoom(user, receiverEmailDto.email);
  }

  @ApiOperation({ summary: `Your chat rooms, most recently active first` })
  @ApiQuery({
    name: 'page',
    description: `1-based page number`,
    required: true,
  })
  @ApiQuery({ name: 'limit', description: `Rooms per page`, required: true })
  @ApiResponse({ type: ChatRoomListDto, status: 200, description: 'Success' })
  @Get('/')
  getRooms(
    @GetUser() user: User,
    @Query('page', ParseIntPipe) page: number,
    @Query('limit', ParseIntPipe) limit: number,
  ): Promise<ChatRoomListDto> {
    return this.chatRoomService.getRooms(user, page, limit);
  }
}
