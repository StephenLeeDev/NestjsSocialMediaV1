import { IsString } from "class-validator";

export class AuthCredentialsDto {

    @IsString()
    username: string;

    @IsString()
    socialType: string;

    @IsString()
    email: string;

}