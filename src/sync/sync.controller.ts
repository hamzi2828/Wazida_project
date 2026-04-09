import {
  Controller,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiQuery,
} from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { BatchSyncDto } from './dto/batch-sync.dto';
import { WebhookDto } from './dto/webhook.dto';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

@ApiTags('Sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('batch')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Receive batch balance sync from HCM' })
  async batchSync(@Body() dto: BatchSyncDto) {
    return this.syncService.batchSync(dto);
  }

  @Post('employee/:employeeId')
  @ApiOperation({ summary: 'Trigger balance sync for a specific employee' })
  @ApiParam({ name: 'employeeId', description: 'Employee identifier' })
  @ApiQuery({
    name: 'locationId',
    required: false,
    description: 'Optional location filter',
  })
  async syncEmployee(
    @Param('employeeId') employeeId: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.syncService.syncEmployee(employeeId, locationId);
  }

  @Post('webhook')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Receive real-time balance change notification from HCM',
  })
  async webhook(@Body() dto: WebhookDto) {
    return this.syncService.handleWebhook(dto);
  }
}
