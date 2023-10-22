import { Controller, Get, Logger, ParseIntPipe, Patch, Post, Query, UploadedFile, Delete, UseGuards, UseInterceptors, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UserInfoDto } from './dto/user-info.dto';
import { GetUser } from 'src/auth/get-user.decorator';
import { User } from './user.entity';
import { ApiImplicitFile } from '@nestjs/swagger/dist/decorators/api-implicit-file.decorator';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { editFileName, imageFileFilter } from 'src/lib/multerOptions';
import { UpdatedUserThumbnailDto } from './dto/updated-user-thumbnail.dto';
import { ConfigService } from '@nestjs/config';
import { UserInfoIncludingIsFollowingDto } from './dto/user-info-including-isfollowing.dto';
import { UserListDto } from './dto/user-list.dto';
import { PostIdDto } from 'src/post/dto/post-id.dto';
import { StatusMessageDto } from './dto/status-message.dto';

@ApiTags('USER')
@UseGuards(AuthGuard())
@ApiBearerAuth('Secret1234')
@Controller('user')
export class UserController {

    private logger = new Logger('UserController');

    constructor(
        private userService: UserService,
        private readonly configService: ConfigService,
    ) { }

    /// Get my user information
    @ApiResponse({
        type: UserInfoDto,
        status: 200,
        description: 'Success',
    })
    @ApiOperation({ summary: `Get my infomation` })
    @Get('/')
    getMyInfo(
        @GetUser() user: User,
    ): Promise<UserInfoDto> {
        this.logger.verbose(`User ${user.email} trying to get own infomation.`);
        
        return this.userService.getUserInfo(user.email);
    }

    /// Get other user information
    /// it's not for current user
    /// If you want to get current user's information, use getMyInfo()
    @ApiResponse({
        type: UserInfoIncludingIsFollowingDto,
        status: 200,
        description: 'Success',
    })
    @ApiQuery({
        name: 'userEmail',
        description: `The user's email who you're trying look up`,
        required: true,
    })
    @ApiOperation({ summary: `Get other user information. it's not for current user.` })
    @Get('/:userEmail')
    getUserInfoByEmail(
        @GetUser() user: User,
        @Query('userEmail') userEmail: string,
    ): Promise<UserInfoIncludingIsFollowingDto> {
        
        return this.userService.getUserInfoByEmail(user.email, userEmail);
    }

    @ApiResponse({
        status: 201,
        description: 'Success',
    })
    @ApiBody({ type: PostIdDto })
    @ApiOperation({ summary: `Bookmark the post if it hasn't been bookmarked yet, or remove the bookmark if it has already been bookmarked.` })
    @Post('/post/bookmark')
    postBookMark(
        @GetUser() user: User,
        @Body() postIdDto: PostIdDto,
    ): Promise<void> {
        return this.userService.postBookMark(user.email, postIdDto.postId);
    }

    @ApiResponse({
        type: UpdatedUserThumbnailDto,
        status: 200,
        description: 'Success',
    })
    @ApiConsumes('multipart/form-data')
    @ApiImplicitFile({ name: 'file', description: `User thumnail`, required: true })
    @ApiOperation({ summary: 'Update user thumbnail' })
    @UseInterceptors(
        FileInterceptor('file', {
          storage: diskStorage({
            destination: './static/images',
            filename: editFileName,
          }),
          fileFilter: imageFileFilter,
        }),
      )
    @Patch('thumbnail')
    updateUserThumbnail(
        @GetUser() user: User,
        @UploadedFile() file: Express.Multer.File,
    ): Promise<UpdatedUserThumbnailDto> {

        return this.userService.updateUserThumbnail(
            user.email,
            `${this.configService.get('SERVER_URL')}/images/${file.filename}`
        );
    }

    @ApiResponse({
        status: 200,
        description: 'Success',
    })
    @ApiOperation({ summary: `Delete the user's thumbnail` })
    @Delete('/thumbnail')
    deleteThumbnail(
        @GetUser() user: User,
    ): Promise<UpdatedUserThumbnailDto> {
        return this.userService.deleteThumbnail(user);
    }

    @ApiResponse({
        status: 200,
        description: 'Success',
    })
    @ApiBody({ type: StatusMessageDto })
    @ApiOperation({ summary: `Update user's status message` })
    @Patch('/statusMessage')
    updateStatusMessage(
        @GetUser() user: User,
        @Body() statusMessageDto: StatusMessageDto,
    ): Promise<void> {
        return this.userService.updateStatusMessage(user.email, statusMessageDto.statusMessage);
    }

    @ApiResponse({
        type: UserListDto,
        status: 200,
        description: 'Success',
    })
    @ApiQuery({
        name: 'keyword',
        description: `Returns users whose username contains the keyword`,
        required: true,
        allowEmptyValue : true
    })
    @ApiQuery({
        name: 'page',
        description: `The page's number to call`,
        required: true,
    })
    @ApiQuery({
        name: 'limit',
        description: `The number of items on a single page`,
        required: true,
    })
    @ApiOperation({ summary: `Search user list by keyword` })
    @Get('/search/users')
    getUserListByKeyword(
        @Query('keyword') keyword: string,
        @Query('page', ParseIntPipe) page: number,
        @Query('limit', ParseIntPipe) limit: number,
    ): Promise<UserListDto> {
        return this.userService.getUserListByKeyword(keyword, page, limit);
    }

}
