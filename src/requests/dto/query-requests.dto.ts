import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
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
}
