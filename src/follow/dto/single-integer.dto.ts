import { ApiProperty } from "@nestjs/swagger";

export class SingleIntegerDto {

    @ApiProperty({
        example: 2,
        description: `Single integer value`,
      })
      value: number;
    
}