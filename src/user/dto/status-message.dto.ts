import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * Request body of PATCH /user/statusMessage.
 *
 * An empty string is allowed: it clears the status message. A missing value
 * is not (it used to answer 200 and silently change nothing).
 */
export class StatusMessageDto {
  @ApiProperty({
    description: `The new status message ("" clears it)`,
    example: `Lorem ipsum`,
  })
  @IsString()
  statusMessage: string;
}
