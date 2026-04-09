import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRequestDto {
  @ApiProperty({ description: 'Employee identifier' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ description: 'Location identifier' })
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({
    description: 'Start date (YYYY-MM-DD)',
    example: '2025-06-01',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date (YYYY-MM-DD)',
    example: '2025-06-02',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'Number of days requested', example: 2 })
  @IsNumber()
  @Min(0.5)
  numberOfDays: number;

  @ApiPropertyOptional({ description: 'Reason for time off' })
  @IsString()
  @IsOptional()
  reason?: string;
}
