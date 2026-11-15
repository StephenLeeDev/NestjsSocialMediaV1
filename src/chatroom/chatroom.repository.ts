import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import { ChatRoomEntity } from "./chatroom.entity";

@Injectable()
export class ChatRoomRepository extends Repository<ChatRoomEntity> {

    constructor(dataSource: DataSource) {
        super(ChatRoomEntity, dataSource.createEntityManager());
    }
    
}