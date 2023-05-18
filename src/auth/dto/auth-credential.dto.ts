import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class AuthCredentialsDto {

    @IsString()
    username: string;

    @IsString()
    socialType: string;

    @IsString()
    socialToken: string;

    @IsString()
    email: string;

}