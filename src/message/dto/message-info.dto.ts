import { ApiProperty } from '@nestjs/swagger';
import { MessageType } from '../message-type';
import { UserSimpleInfoIncludingStatusMessageDto } from '../../user/dto/user-simple-info-including-status-message.dto';

/**
 * ============================================================================
 *  Message response DTOs
 * ============================================================================
 *
 * The same MessageInfoDto is returned by POST /message, listed by GET /message
 * and pushed to sockets as the 'newMessage' event. Built by message.mapper.ts.
 */
export class MessageInfoDto {
  @ApiProperty({ example: 1, description: `The ID of the message.` })
  id: number;

  @ApiProperty({
    example: 2,
    description: `The chat room the message belongs to (useful for socket listeners that joined several rooms).`,
  })
  chatRoomId: number;

  @ApiProperty({
    example: 'Lorem ipsum',
    description: `The message's content`,
  })
  content: string;

  @ApiProperty({
    enum: MessageType,
    example: MessageType.TEXT,
    description: `TEXT or IMAGE`,
  })
  type: MessageType;

  @ApiProperty({
    type: UserSimpleInfoIncludingStatusMessageDto,
    description: `Who wrote the message.`,
  })
  sender: UserSimpleInfoIncludingStatusMessageDto;

  @ApiProperty({
    example: `2022-06-12 06:00:22.206Z`,
    description: `When the message was sent.`,
  })
  createdAt: Date;

  @ApiProperty({
    example: `2022-06-12 06:00:22.206Z`,
    description: `When the message was last changed.`,
  })
  updatedAt: Date;
}

/** One page of a room's messages, newest first. */
export class MessageInfoListDto {
  @ApiProperty({
    type: [MessageInfoDto],
    description: `The messages on this page.`,
  })
  messages: MessageInfoDto[];

  @ApiProperty({
    example: 10,
    description: `The room's total number of messages (all pages).`,
  })
  total: number;
}
