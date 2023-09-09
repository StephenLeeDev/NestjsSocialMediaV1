import { ApiProperty } from "@nestjs/swagger";
import { UserSimpleInfoIncludingStatusMessageDto } from "./user-simple-info-including-status-message.dto";

export class UserListDto {

  @ApiProperty({ type: [UserSimpleInfoIncludingStatusMessageDto] })
  userList: UserSimpleInfoIncludingStatusMessageDto[];
  @ApiProperty({
      example: 10,
      description: `The total count can call`,
  })
  total: number;
}