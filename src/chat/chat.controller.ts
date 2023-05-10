import { Controller, Get } from '@nestjs/common';

@Controller('chat')
export class ChatController {

    @Get('/')
    getBoardById(): string {
        return "chatMessages";
    }

}
