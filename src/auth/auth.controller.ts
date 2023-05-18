import { Body, Controller, Post, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthCredentialsDto } from './dto/auth-credential.dto';
import { GetUser } from './get-user.decorator';
import { User } from './user.entity';
import { ApiParam, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('USER')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }
    
    @ApiParam({
        name: 'socialType',
        required: true,
        description: "User's social platform type",
    })
    @ApiParam({
        name: 'socialToken',
        required: true,
        description: "User's social platform account token",
    })
    @ApiResponse({
        type: String,
        status: 201,
        description: 'Success',
    })
    @ApiOperation({ summary: 'Sign up' })
    @Post('/signup')
    signUp(@Body() authCredentialsDTO: AuthCredentialsDto): Promise<{accessToken: string}> {
        return this.authService.signUp(authCredentialsDTO);
    }

    @ApiResponse({
        type: String,
        status: 200,
        description: 'Success',
    })
    @ApiOperation({ summary: 'Sign in' })
    @Post('/signin')
    signIn(@Body(ValidationPipe) AuthCredentialsDto: AuthCredentialsDto): Promise<{accessToken: string}> {
        return this.authService.signIn(AuthCredentialsDto);
    }

    @ApiResponse({
        type: String,
        status: 200,
        description: 'Success',
    })
    @ApiResponse({
        type: String,
        status: 201,
        description: 'Success',
    })
    @ApiOperation({ summary: 'Test sign in' })
    @Post('/test')
    test(): Promise<{ accessToken: string }> {
        return this.authService.test();
    }

}
