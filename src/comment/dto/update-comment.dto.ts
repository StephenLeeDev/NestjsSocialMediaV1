import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class UpdateCommentDto {

    @ApiProperty({
        example: 1,
        description: `The ID of the comment.`,
    })
    id: number;
    
    @ApiProperty({
      example: 'Lorem ipsum',
      description: `The comment's content`,
    })
    @IsNotEmpty()
    content: string;
    
}