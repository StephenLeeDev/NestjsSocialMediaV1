import { ApiProperty } from "@nestjs/swagger";

export class UserSimpleInfoDto {

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

}