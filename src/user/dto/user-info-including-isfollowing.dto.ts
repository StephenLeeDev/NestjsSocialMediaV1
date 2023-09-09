import { ApiProperty } from "@nestjs/swagger";
import { UserInfoDto } from "./user-info.dto";

/// It's basically the same as UserInfoDto, but it has an extra field isFollowing
/// It represents current user is following the user, or not
export class UserInfoIncludingIsFollowingDto extends UserInfoDto {
    @ApiProperty({
      example: true,
      description: `Whether the current user is following this user or not`,
    })
    isFollowing: boolean;
}