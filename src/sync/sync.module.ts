import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { BalancesModule } from '../balances/balances.module';
import { HcmModule } from '../hcm/hcm.module';

@Module({
  imports: [BalancesModule, HcmModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
