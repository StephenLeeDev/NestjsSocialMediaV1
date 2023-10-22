import { ApiProperty } from "@nestjs/swagger";

export class StatusMessageDto {

    @ApiProperty({
        description: `The new status message`,
        example: `Lorem ipsum`,
    })
    statusMessage: string;
}