import { ApiProperty } from "@nestjs/swagger";
import { UserSimpleInfoDto } from "./user-simple-info.dto";

export class UserSimpleInfoIncludingStatusMessageDto extends UserSimpleInfoDto {
    @ApiProperty({
      example: "Lorem ipsum",
      description: `User's status message`,
    })
    statusMessage: string;
}