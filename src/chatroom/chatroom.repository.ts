import { EntityRepository, Repository } from "typeorm";
import { ChatRoomEntity } from "./chatroom.entity";

@EntityRepository(ChatRoomEntity)
export class ChatRoomRepository extends Repository<ChatRoomEntity> {
    
}