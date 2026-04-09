import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { RequestStatus } from '../request-status.enum';

export class QueryRequestsDto {
  @ApiPropertyOptional({ description: 'Filter by employee ID' })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Filter by location ID' })
  @IsString()
  @IsOptional()
  locationId?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: RequestStatus,
  })
  @IsEnum(RequestStatus)
  @IsOptional()
  status?: RequestStatus;

  @ApiPropertyOptional({ description: 'Page number (starts at 1)', default: 1 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page (max 100)', default: 20 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
