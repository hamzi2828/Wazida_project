import {
  IsArray,
  ValidateNested,
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BatchSyncRecordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  totalDays: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  hcmVersion?: string;
}

export class BatchSyncDto {
  @ApiProperty({ type: [BatchSyncRecordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchSyncRecordDto)
  records: BatchSyncRecordDto[];
}
