import { ApiProperty } from "@nestjs/swagger";
import { UserSimpleInfoIncludingStatusMessageDto } from "src/user/dto/user-simple-info-including-status-message.dto";
import { User } from "src/user/user.entity";

export class ChatRoomDto {

    @ApiProperty({
        example: 13,
        description: `Chatroom's ID`,
    })
    id: number;
    
    @ApiProperty({
        example: "John",
        description: `Chatroom's name`,
    })
    name: string;
    
    @ApiProperty({
        example: "Lorem ipsum",
        description: `Chatroom's last message`,
    })
    latestMessage: string;
    
    @ApiProperty({
        example: [`john@gmail.com`, `smith@gmail.com`],
        description: `Participants' email addresses`,
    })
    participants: User[];
    
    @ApiProperty({
        type: [UserSimpleInfoIncludingStatusMessageDto],
        description: `Chat partner's information`
    })
    chatPartner: UserSimpleInfoIncludingStatusMessageDto;
    
    @ApiProperty({
        example: `2022-06-12 06:00:22.206Z`,
        description: `The chatroom's created date`,
    })
    createdAt: Date;
    
    @ApiProperty({
        example: `2022-06-12 06:00:22.206Z`,
        description: `The chatroom's updated date`,
    })
    updatedAt: Date;
    
}

export class ChatRoomListDto {
    @ApiProperty({ type: [ChatRoomDto] })
    list: ChatRoomDto[];
    @ApiProperty({
        example: 10,
        description: `The chat room's total count`,
    })
    total: number;
}