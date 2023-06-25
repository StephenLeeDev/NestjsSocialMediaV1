import { ApiProperty } from "@nestjs/swagger";

export class PostLikeCountDto {

    @ApiProperty({
        example: 3,
        description: `The total like count of the post.`,
    })
    likeCount: number;
    
}