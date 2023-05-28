import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { AuthSocialType } from "../auth-social-type-validation.enum";

export class AuthCredentialsDto {

    @ApiProperty({
        example: 'Stephen',
        description: `User's name`,
      })
    @IsString()
    username: string;

    @ApiProperty({
        example: AuthSocialType.GOOGLE,
        description: `User's social media platform`,
      })
    @IsString()
    socialType: string;

    @ApiProperty({
        example: 'testUser@gmail.com',
        description: `User's email address`,
      })
    @IsString()
    email: string;

}