import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/**
 * Request body that only carries a user's email.
 * Used by POST /follow (the user to follow).
 */
export class EmailDto {
  @ApiProperty({
    description: `The user's email address`,
    example: `john@gmail.com`,
  })
  // A missing value or text that is not an email address → 400.
  @IsEmail()
  email: string;
}
