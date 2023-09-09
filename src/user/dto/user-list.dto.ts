import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { UserInfoDto } from "src/user/dto/user-info.dto";

export class UserListDto {

  @ApiProperty({ type: [UserInfoDto] })
  userList: UserInfoDto[];
  @ApiProperty({
      example: 10,
      description: `The total count can call`,
  })
  total: number;
}