import { Body, Controller, Post, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthCredentialsDto } from './dto/auth-credential.dto';
import { GetUser } from './get-user.decorator';
import { User } from './user.entity';
import { ApiParam, ApiOperation, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { AuthSocialTypeValidationPipe } from './pipe/auth-social-type-validation.pipe';
import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

const authCredentialsSchema: SchemaObject = {
    type: 'object',
    properties: {
    username: { type: 'string' },
    socialType: { type: 'string' },
    email: { type: 'string' },
    },
    required: ['username', 'socialType', 'email'],
};

@ApiTags('USER')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }
    
    @ApiBody({
        schema: authCredentialsSchema,
        type: AuthCredentialsDto,
        examples: {
          example: {
            value: {
              username: 'testUser',
              socialType: 'GOOGLE',
              email: 'testUser@gmail.com',
            },
            description: 'Example request body',
          },
        },
      })
    @ApiResponse({
        type: String,
        status: 201,
        description: 'Success',
    })
    @ApiOperation({ summary: 'Sign up' })
    @Post('/signup')
    signUp(
        // @Body(AuthSocialTypeValidationPipe) authCredentialsDTO: AuthCredentialsDto
        @Body() authCredentialsDTO: AuthCredentialsDto
    ): Promise<{ accessToken: string }> {
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
