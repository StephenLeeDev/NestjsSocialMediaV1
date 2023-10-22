import { ApiProperty } from "@nestjs/swagger";

export class PostIdDto {

    @ApiProperty({
        example: 12,
        description: `Post's description`,
    })
    postId: number;

}