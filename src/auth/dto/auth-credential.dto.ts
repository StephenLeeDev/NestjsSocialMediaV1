import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class AuthCredentialsDto {

    @IsString()
    @MinLength(4)
    @MaxLength(20)
    username: string;

    @IsString()
    @MinLength(4)
    @MaxLength(20)
    @Matches(/^[a-zA-z0-9]*$/, {
        message: 'Password only accepts English and number'
    })
    password: string;

}