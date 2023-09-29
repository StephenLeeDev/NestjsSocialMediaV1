import { ApiProperty } from "@nestjs/swagger";
import { User } from "src/user/user.entity";

export class ChatRoomDto {

    @ApiProperty({
        example: 13,
        description: `Chatroom's ID`,
    })
    id: string;
    
    @ApiProperty({
        example: "John",
        description: `Chatroom's name`,
    })
    name: string;
    
    @ApiProperty({
        example: [`john@gmail.com`, `smith@gmail.com`],
        description: `Participants' email addresses`,
    })
    participants: User[];
    
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