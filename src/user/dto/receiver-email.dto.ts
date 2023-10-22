import { ApiProperty } from "@nestjs/swagger";

export class ReceiverEmailDto {

    @ApiProperty({
        description: `The receiver's email address`,
        example: `john@gmail.com`,
    })
    email: string;
}