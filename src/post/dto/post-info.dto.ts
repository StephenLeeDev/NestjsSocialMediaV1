import { ApiProperty } from "@nestjs/swagger";
import { PostStatus } from "../post-status.enum";
import { UserSimpleInfoDto } from "src/user/dto/user-simple-info.dto";

export class PostInfoDto {

    @ApiProperty({
        example: 1,
        description: `The ID of the post.`,
    })
    id: number;

    @ApiProperty({
        example: 'This is a sample post description.',
        description: `The description of the post.`,
    })
    description: string;
          
    @ApiProperty({
        example: PostStatus.PUBLIC,
        description: `The status of the post.`,
    })
    status: PostStatus;

    @ApiProperty({
        example: '2023-06-13T12:34:56Z',
        description: `The date and time when the post was created.`,
    })
    createdAt: Date;
         
    @ApiProperty({
        example: '2023-06-13T12:34:56Z',
        description: `The date and time when the post was last updated.`,
    })
    updatedAt: Date;
          
    @ApiProperty({
        example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        description: `The URLs of the images associated with the post.`,
    })
    imageUrls: string[];

    @ApiProperty({ type: [UserSimpleInfoDto] })
    user: UserSimpleInfoDto
        
    @ApiProperty({
        example: ['john@gmail.com'],
        description: `The list of email who liked the post.`,
    })
    likes: string[];
          
    @ApiProperty({
        example: ['john@gmail.com'],
        description: `The list of email who bookmarked the post.`,
    })
    bookMarkedUsers: string[];
          
    @ApiProperty({
        example: 5,
        description: `The number of comments on the post.`,
    })
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