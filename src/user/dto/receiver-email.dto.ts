import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/**
 * Request body of POST /chat: the user to open a direct-message room with.
 */
export class ReceiverEmailDto {
  @ApiProperty({
    description: `The other user's email address`,
    example: `john@gmail.com`,
  })
  // A missing value or text that is not an email address → 400.
  @IsEmail()
  email: string;
}
