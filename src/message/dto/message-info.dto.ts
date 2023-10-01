import { ApiProperty } from "@nestjs/swagger";
import { MessageType } from "../message-type";
import { UserSimpleInfoIncludingStatusMessageDto } from "src/user/dto/user-simple-info-including-status-message.dto";

export class MessageInfoDto {

    @ApiProperty({
        example: 1,
        description: `The ID of the message.`,
    })
    id: number;
    
    @ApiProperty({
      example: 'Lorem ipsum',
      description: `The message's content`,
    })
    content: string;
    
    @ApiProperty({
        example: MessageType.TEXT,
        description: `The type of the message.`,
    })
    type: MessageType;
    
    @ApiProperty({
        example: `john@gmail.com`,
        description: `The email of its author.`,
    })
    sender: UserSimpleInfoIncludingStatusMessageDto;
    
    @ApiProperty({
        example: `2022-06-12 06:00:22.206Z`,
        description: `The created date of the message.`,
    })
    createdAt: Date;
    
    @ApiProperty({
        example: `2022-06-12 06:00:22.206Z`,
        description: `The updated date of the message.`,
    })
    updatedAt: Date;
    
}

export class MessageInfoListDto {
    @ApiProperty({ type: [MessageInfoDto] })
    messages: MessageInfoDto[];
    @ApiProperty({
        example: 10,
        description: `The message's total count`,
    })
    total: number;
}