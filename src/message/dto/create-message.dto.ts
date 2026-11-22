import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsString } from 'class-validator';
import { MessageType } from '../message-type';

/**
 * Request body of POST /message: send a message to a chat room.
 *
 * Only the SHAPE is checked here. Whether the sender may write in this room
 * (participants only) is checked by MessageService.
 */
export class CreateMessageDto {
  @ApiProperty({ example: 2, description: `The chat room's ID` })
  // A whole number. (It used to be typed as a string and converted later; now
  // a value like "abc" is rejected up front with 400.)
  @IsInt()
  chatRoomId: number;

  @ApiProperty({
    example: 'Lorem ipsum',
    description: `The message's text (or the image URL for IMAGE messages)`,
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    enum: MessageType,
    example: MessageType.TEXT,
    description: `TEXT or IMAGE`,
  })
  // Only the values of the MessageType enum are accepted.
  @IsEnum(MessageType)
  type: MessageType;
}
