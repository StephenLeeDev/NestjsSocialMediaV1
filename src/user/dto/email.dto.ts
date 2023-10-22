import { ApiProperty } from "@nestjs/swagger";

export class EmailDto {

    @ApiProperty({
        description: `The user's email address`,
        example: `john@gmail.com`,
    })
    email: string;
}