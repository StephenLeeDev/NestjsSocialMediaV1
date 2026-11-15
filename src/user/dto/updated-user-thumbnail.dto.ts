import { ApiProperty } from '@nestjs/swagger';

export class UpdatedUserThumbnailDto {
  @ApiProperty({
    example: 'http://localhost:3001/images/default/dafault_thumbnail.png',
    description: `User's updated thumbnail url`,
  })
  updatedThumbnail: string;
}
