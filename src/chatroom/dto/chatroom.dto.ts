import { ApiProperty } from '@nestjs/swagger';
import { UserSimpleInfoIncludingStatusMessageDto } from '../../user/dto/user-simple-info-including-status-message.dto';

/**
 * ============================================================================
 *  Chat room response DTOs
 * ============================================================================
 *
 * A chat room as seen by ONE participant (the "viewer"): `name` and
 * `chatPartner` describe the OTHER person, and `participants` lists the viewer
 * first. Built by ChatRoomService.toChatRoomDto for both POST /chat and
 * GET /chat, so both return the same shape. (List items used to lack `name`
 * and `participants`.) The Flutter app's DmRoomModel reads these fields.
 */
export class ChatRoomDto {
  @ApiProperty({ example: 13, description: `The chat room's ID` })
  id: number;

  @ApiProperty({
    example: 'John',
    description: `The room's name: the chat partner's username`,
  })
  name: string;

  @ApiProperty({
    example: 'Lorem ipsum',
    description: `The newest message's text ("" when there is none yet)`,
  })
  latestMessage: string;

  @ApiProperty({
    example: [`me@gmail.com`, `john@gmail.com`],
    description: `Both participants' emails, the viewer first`,
  })
  participants: string[];

  @ApiProperty({
    type: UserSimpleInfoIncludingStatusMessageDto,
    description: `The other participant`,
  })
  chatPartner: UserSimpleInfoIncludingStatusMessageDto;

  @ApiProperty({
    example: `2022-06-12 06:00:22.206Z`,
    description: `When the room was created`,
  })
  createdAt: Date;

  @ApiProperty({
    example: `2022-06-12 06:00:22.206Z`,
    description: `Last activity: creation or the newest message`,
  })
  updatedAt: Date;
}

/** One page of the viewer's chat rooms, most recently active first. */
export class ChatRoomListDto {
  @ApiProperty({ type: [ChatRoomDto], description: `The rooms on this page` })
  list: ChatRoomDto[];

  @ApiProperty({
    example: 10,
    description: `The viewer's total number of rooms (all pages)`,
  })
  total: number;
}
