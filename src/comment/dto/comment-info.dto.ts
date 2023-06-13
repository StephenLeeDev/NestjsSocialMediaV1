import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { CommentType } from "src/comment/comment-type.enum";

export class CommentInfoDto {

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
    
    @ApiProperty({
        example: CommentType.Comment,
        description: `The type of the comment.`,
    })
    type: CommentType;
    
    @ApiProperty({
        example: 1,
        description: `The ID of the parent comment for this reply. It can be null.`,
    })
    parentCommentId: number;
    
    @ApiProperty({
        example: 'john@gmail.com',
        description: `The email of the parent comment's author for this reply. It can be null.`,
    })
    parentCommentAuthor: string;
    
    @ApiProperty({
        example: 1,
        description: `The ID of the post for this comment.`,
    })
    @IsNotEmpty()
    postId: number;
      
    @ApiProperty({
        example: `john@gmail.com`,
        description: `The email of its author.`,
    })
    @IsNotEmpty()
    email: string;
    
    @ApiProperty({
        example: `2022-06-12 06:00:22.206Z`,
        description: `The created date the comment.`,
    })
    @IsNotEmpty()
    createdAt: Date;
    
    @ApiProperty({
        example: `2022-06-12 06:00:22.206Z`,
        description: `The updated date the comment.`,
    })
    @IsNotEmpty()
    updatedAt: Date;
    
}