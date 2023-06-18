import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class CreatePostDto {

  @ApiProperty({
    example: 'Write a description here',
    description: `Post's description`,
  })
  @IsNotEmpty()
  description: string;
  
}