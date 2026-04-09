import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewRequestDto {
  @ApiProperty({ description: 'Manager/reviewer identifier' })
  @IsString()
  @IsNotEmpty()
  reviewedBy: string;
}
