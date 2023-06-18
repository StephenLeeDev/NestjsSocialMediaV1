import { Controller, Get, Logger, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UserInfoDto } from './dto/user-info.dto';
import { GetUser } from 'src/auth/get-user.decorator';
import { User } from './user.entity';
import { bookMarksDTO } from './dto/book-marks.dto';

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
            bookMarks: user.bookMarks
        };

        return userInfo;
    }

    @ApiResponse({
        type: bookMarksDTO,
        status: 200,
        description: 'Success',
    })
    @ApiQuery({
        name: 'postId',
        description: `The ID of the post to bookmark/unbookmark`,
        required: true,
    })
    @ApiOperation({ summary: `Bookmark the post if it hasn't been bookmarked yet, or remove the bookmark if it has already been bookmarked.` })
    @Post('/post/bookmark')
    postBookMark(
        @GetUser() user: User,
        @Query('postId', ParseIntPipe) postId: number,
    ): Promise<bookMarksDTO> {
        return this.userService.postBookMark(user.email, postId);
    }

}
