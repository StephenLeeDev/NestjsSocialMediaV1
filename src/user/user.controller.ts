import { Controller, Get, Logger, ParseIntPipe, Patch, Post, Query, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { UserService } from './user.service';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
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

@ApiTags('USER')
@UseGuards(AuthGuard())
@ApiBearerAuth('Secret1234')
@Controller('user')
export class UserController {

    private logger = new Logger('UserController');

    constructor(
        private userService: UserService,
        private readonly configService: ConfigService
    ) { }

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

    @ApiResponse({
        status: 201,
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
    ): Promise<void> {
        return this.userService.postBookMark(user.email, postId);
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
    @ApiQuery({
        name: 'newStatusMessage',
        description: `New user's status message`,
        required: true,
        allowEmptyValue : true
    })
    @ApiOperation({ summary: `Update user's status message` })
    @Patch('/statusMessage')
    updateStatusMessage(
        @GetUser() user: User,
        @Query('newStatusMessage') newStatusMessage: string,
    ): Promise<void> {
        return this.userService.updateStatusMessage(user.email, newStatusMessage);
    }

}
