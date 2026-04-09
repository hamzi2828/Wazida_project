import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WebhookEventType {
  BALANCE_UPDATED = 'BALANCE_UPDATED',
  BALANCE_RESET = 'BALANCE_RESET',
}

export class WebhookDto {
  @ApiProperty({ enum: WebhookEventType })
  @IsEnum(WebhookEventType)
  eventType: WebhookEventType;

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
