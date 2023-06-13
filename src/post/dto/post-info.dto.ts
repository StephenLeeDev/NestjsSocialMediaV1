import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { PostStatus } from "../post-status.enum";

export class PostInfoDto {

    @ApiProperty({
        example: 1,
        description: `The ID of the post.`,
    })
    @IsNotEmpty()
    id: number;

    @ApiProperty({
        example: 'This is a sample post description.',
        description: `The description of the post.`,
    })
    @IsNotEmpty()
    description: string;
          
    @ApiProperty({
        example: PostStatus.PUBLIC,
        description: `The status of the post.`,
    })
    @IsNotEmpty()
    status: PostStatus;

    @ApiProperty({
        example: 'john@gmail.com',
        description: `The email of the post's author`,
    })
    @IsNotEmpty()
    email: String
        
    @ApiProperty({
        example: '2023-06-13T12:34:56Z',
        description: `The date and time when the post was created.`,
    })
    @IsNotEmpty()
    createdAt: Date;
         
    @ApiProperty({
        example: '2023-06-13T12:34:56Z',
        description: `The date and time when the post was last updated.`,
    })
    @IsNotEmpty()
    updatedAt: Date;
          
    @ApiProperty({
        example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        description: `The URLs of the images associated with the post.`,
    })
    @IsNotEmpty()
    imageUrls: string[];
        
    @ApiProperty({
        example: ['john@gmail.com'],
        description: `The list of email who liked the post.`,
    })
    @IsNotEmpty()
    likes: string[];
          
    @ApiProperty({
        example: ['john@gmail.com'],
        description: `The list of email who bookmarked the post.`,
    })
    @IsNotEmpty()
    bookMarkedUsers: string[];
          
    @ApiProperty({
        example: 5,
        description: `The number of comments on the post.`,
    })
    @IsNotEmpty()
    commentCount: number;
          
}

export class PostResponse {
    @ApiProperty({ type: [PostInfoDto] })
    posts: PostInfoDto[];
    @ApiProperty({
        example: 10,
        description: `The post's total count can call`,
    })
    total: number;
}