import { ApiProperty } from "@nestjs/swagger";

export class UserInfoDto {

  @ApiProperty({
    example: 'john@gmail.com',
    description: `User's email address`,
  })
  email: string;

  @ApiProperty({
    example: 'John',
    description: `User's name`,
  })
  username: string;

  @ApiProperty({
    example: 'localhost:3000/public/images/default_thumbnail.png',
    description: `User's thumbnail url`,
  })
  thumbnail: string;

  @ApiProperty({
    example: [1,2],
    description: `The list of post IDs that user has bookmarked`,
  })
  bookMarks: number[];

}