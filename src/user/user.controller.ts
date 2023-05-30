import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UserInfoDto } from './dto/user-info.dto';
import { GetUser } from 'src/auth/get-user.decorator';
import { User } from './user.entity';

@ApiTags('USER')
@UseGuards(AuthGuard())
@ApiBearerAuth('Secret1234')
@Controller('user')
export class UserController {

    private logger = new Logger('UserController');

    constructor(private userService: UserService) { }

    @ApiResponse({
        type: UserInfoDto,
        status: 200,
        description: 'Success',
    })
    @ApiOperation({ summary: `Get my infomation` })
    @Get('/')
    getMyInfo(
        @GetUser() user: User,
    ): UserInfoDto {
        this.logger.verbose(`User ${user.email} trying to get own infomation.`);
        
        const userInfo: UserInfoDto = {
            email: user.email,
            username: user.username,
            thumbnail: user.thumbnail,
        };

        return userInfo;
    }


}
