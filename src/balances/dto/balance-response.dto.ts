import { ApiProperty } from '@nestjs/swagger';

export class BalanceResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  locationId: string;

  @ApiProperty()
  totalDays: number;

  @ApiProperty()
  usedDays: number;

  @ApiProperty()
  pendingDays: number;

  @ApiProperty()
  availableDays: number;

  @ApiProperty({ nullable: true })
  hcmLastSyncedAt: Date | null;

  @ApiProperty()
  updatedAt: Date;
}
