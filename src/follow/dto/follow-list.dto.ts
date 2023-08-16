import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { UserInfoDto } from "src/user/dto/user-info.dto";

export class FollowListDto {

  @ApiProperty({ type: [UserInfoDto] })
  follows: UserInfoDto[];
  @ApiProperty({
      example: 10,
      description: `The total count can call`,
  })
  total: number;
}