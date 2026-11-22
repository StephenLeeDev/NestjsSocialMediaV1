/**
 * ============================================================================
 *  MessageController: HTTP endpoints for direct messages (/message)
 * ============================================================================
 *
 * Responsibility: HTTP only (routes, parsing, Swagger). Every rule lives in
 * MessageService. All routes require a signed-in user.
 *
 * Messages are always SENT through POST /message (also by real-time clients);
 * the server then pushes them to the room's sockets (see ChatGateway).
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
import { User } from '../user/user.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageInfoDto, MessageInfoListDto } from './dto/message-info.dto';
import { MessageService } from './message.service';

@ApiTags('MESSAGE')
@UseGuards(AuthGuard())
@ApiBearerAuth('Secret1234')
@Controller('message')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @ApiOperation({
    summary: `Send a message to one of your chat rooms (also pushed to the room's sockets)`,
  })
  @ApiBody({ type: CreateMessageDto })
  @ApiResponse({ type: MessageInfoDto, status: 201, description: 'Created' })
  @Post('/')
  sendMessage(
    @Body() createMessageDto: CreateMessageDto,
    @GetUser() user: User,
  ): Promise<MessageInfoDto> {
    return this.messageService.sendMessage(user, createMessageDto);
  }

  @ApiOperation({
    summary: `The messages of one of your chat rooms, newest first`,
  })
  @ApiQuery({
    name: 'chatRoomId',
    description: `The chat room ID`,
    required: true,
  })
  @ApiQuery({
    name: 'page',
    description: `1-based page number`,
    required: true,
  })
  @ApiQuery({ name: 'limit', description: `Messages per page`, required: true })
  @ApiResponse({
    type: MessageInfoListDto,
    status: 200,
    description: 'Success',
  })
  @Get('/')
  getMessages(
    @GetUser() user: User,
    @Query('chatRoomId', ParseIntPipe) chatRoomId: number,
    @Query('page', ParseIntPipe) page: number,
    @Query('limit', ParseIntPipe) limit: number,
  ): Promise<MessageInfoListDto> {
    return this.messageService.getMessages(user, chatRoomId, page, limit);
  }
}
