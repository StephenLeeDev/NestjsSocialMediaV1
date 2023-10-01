import { EntityRepository, Repository } from "typeorm";
import { ChatRoomEntity } from "./chatroom.entity";
import { User } from "src/user/user.entity";
import * as moment from 'moment-timezone';
import { ChatRoomDto } from "./dto/chatroom.dto";

@EntityRepository(ChatRoomEntity)
export class ChatRoomRepository extends Repository<ChatRoomEntity> {

}