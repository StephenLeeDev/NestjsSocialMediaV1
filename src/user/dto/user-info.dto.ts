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

  // TODO : Low priority
  // TODO : Refactor this field's type to number from array
  @ApiProperty({
    example: [1,2],
    description: `The list of post IDs that user has bookmarked`,
  })
  bookMarks: number[];

  @ApiProperty({
    example: `I'm hungry`,
    description: `User's status message`,
  })
  statusMessage: string;

  @ApiProperty({
    example: 5,
    description: `The number of user's feed`,
  })
  totalPostCount: number;

  @ApiProperty({
    example: 5,
    description: `The number of user's followers`,
  })
  followers: number;

  @ApiProperty({
    example: 7,
    description: `The number of user's followings`,
  })
  followings: number;

}