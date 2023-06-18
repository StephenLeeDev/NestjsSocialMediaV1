import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { CommentType } from "../comment-type.enum";

export class CreateCommentDto {

    @ApiProperty({
      example: 'Write a comment here.',
      description: `The comment's content`,
    })
    @IsNotEmpty()
    content: string;
    
    @ApiProperty({
        example: 1,
        description: `The ID of the post for this comment.`,
    })
    @IsNotEmpty()
    postId: number;

    @ApiProperty({
        description: `The ID of the parent comment for this reply. It can be null.`,
    })
    parentCommentId: number;
    
    @ApiProperty({
        description: `The email of the parent comment's author for this reply. It can be null.`,
    })
    parentCommentAuthor: string;
    
    type: CommentType;
    
    createdAt: Date;
    
    updatedAt: Date;
    
}