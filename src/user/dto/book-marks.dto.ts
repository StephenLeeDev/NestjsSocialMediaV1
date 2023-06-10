import { ApiProperty } from "@nestjs/swagger";

export class bookMarksDTO {

  @ApiProperty({
    example: [1, 2],
    description: `User's bookmarked post ID list`,
  })
  bookMarks: number[];

}