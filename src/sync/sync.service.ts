import { Injectable, Logger } from '@nestjs/common';
import { BalancesService } from '../balances/balances.service';
import { HcmService } from '../hcm/hcm.service';
import { BatchSyncDto } from './dto/batch-sync.dto';
import { WebhookDto } from './dto/webhook.dto';
import { Balance } from '../balances/balance.entity';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly balancesService: BalancesService,
    private readonly hcmService: HcmService,
  ) {}

  async batchSync(
    dto: BatchSyncDto,
  ): Promise<{ updated: number; created: number }> {
    this.logger.log(
      `Processing batch sync with ${dto.records.length} records`,
    );
    return this.balancesService.batchUpsert(dto.records);
  }

  async syncEmployee(
    employeeId: string,
    locationId?: string,
  ): Promise<Balance | Balance[]> {
    if (locationId) {
      const hcmBalance = await this.hcmService.getBalance(
        employeeId,
        locationId,
      );
      const balance = await this.balancesService.upsertFromHcm(
        employeeId,
        locationId,
        hcmBalance.totalDays,
        hcmBalance.version,
      );
      this.logger.log(
        `Synced balance for employee=${employeeId} location=${locationId}`,
      );
      return balance;
    }

    const existingBalances =
      await this.balancesService.findByEmployee(employeeId);
    const results: Balance[] = [];

    for (const existing of existingBalances) {
      try {
        const hcmBalance = await this.hcmService.getBalance(
          employeeId,
          existing.locationId,
        );
        const updated = await this.balancesService.upsertFromHcm(
          employeeId,
          existing.locationId,
          hcmBalance.totalDays,
          hcmBalance.version,
        );
        results.push(updated);
      } catch (error: any) {
        this.logger.warn(
          `Failed to sync balance for employee=${employeeId} location=${existing.locationId}: ${error.message}`,
        );
      }
    }

    return results;
  }

  async handleWebhook(
    dto: WebhookDto,
  ): Promise<{ acknowledged: boolean; balance: Balance }> {
    this.logger.log(
      `Webhook received: ${dto.eventType} for employee=${dto.employeeId} location=${dto.locationId}`,
    );

    const balance = await this.balancesService.upsertFromHcm(
      dto.employeeId,
      dto.locationId,
      dto.totalDays,
      dto.hcmVersion,
    );

    return { acknowledged: true, balance };
  }
}
