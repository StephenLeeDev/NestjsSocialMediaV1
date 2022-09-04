import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthCredentialsDto } from './dto/auth-credential.dto';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }
    
    @Post('/signup')
    signUp(@Body() authCredentialsDTO: AuthCredentialsDto): Promise<void> {
        return this.authService.signUp(authCredentialsDTO);
    }

    @Post('/signin')
    signIn(@Body(ValidationPipe) AuthCredentialsDto: AuthCredentialsDto) {
        return this.authService.signIn(AuthCredentialsDto);
    }

}
