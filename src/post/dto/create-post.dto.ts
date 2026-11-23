import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Text fields of the "create post" request (POST /post).
 *
 * The request is `multipart/form-data`: the images arrive as files in the
 * `files` field and are handled by Multer in the controller, NOT by this DTO.
 * This DTO only describes the normal text fields that come along with them.
 *
 * The rules below are checked by the global ValidationPipe (see app.setup.ts);
 * a request that breaks them is answered with 400 Bad Request.
 */
export class CreatePostDto {
  @ApiProperty({
    example: 'Write a description here',
    description: `Post's description`,
  })
  // In multipart requests every text field arrives as a string.
  @IsString()
  // Rejects a missing field as well as an empty string "".
  @IsNotEmpty()
  description: string;
}
