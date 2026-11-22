import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/**
 * Query parameters that carry a user's email, e.g. `?email=john@gmail.com`.
 *
 * Used with `@Query() query: EmailQueryDto`: the global ValidationPipe checks
 * query objects exactly like request bodies, so a missing or malformed email
 * is answered with 400 before the service runs. (Without it, `undefined`
 * reached the database queries.)
 *
 * Other query parameters of the same request (such as `page` and `limit`) may
 * be present as well; they are read separately with ParseIntPipe.
 */
export class EmailQueryDto {
  @ApiProperty({
    description: `The user's email address`,
    example: `john@gmail.com`,
  })
  @IsEmail()
  email: string;
}
