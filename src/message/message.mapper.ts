/**
 * ============================================================================
 *  Message mapper: MessageEntity (database row) → MessageInfoDto (response)
 * ============================================================================
 *
 * Used for the POST response, the GET list and the socket 'newMessage' event,
 * so a message looks the same wherever a client receives it. (The field-by-
 * field copy used to be written out twice in the repository.)
 */
import { toUserSummaryDto } from '../user/user.mapper';
import { MessageInfoDto } from './dto/message-info.dto';
import { MessageEntity } from './message.entity';

/**
 * @param message    The message, loaded WITH its sender (`message.sender`).
 * @param chatRoomId The room it belongs to. Passed in explicitly because list
 *                   queries do not load the room relation (it is the same for
 *                   every message of the page).
 */
export function toMessageInfoDto(
  message: MessageEntity,
  chatRoomId: number,
): MessageInfoDto {
  const dto = new MessageInfoDto();
  dto.id = message.id;
  dto.chatRoomId = chatRoomId;
  dto.content = message.content;
  dto.type = message.type;
  dto.sender = toUserSummaryDto(message.sender);
  dto.createdAt = message.createdAt;
  dto.updatedAt = message.updatedAt;
  return dto;
}
