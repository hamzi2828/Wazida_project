import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { SyncService } from './sync.service';
import { BalancesService } from '../balances/balances.service';
import { HcmService } from '../hcm/hcm.service';
import { Balance } from '../balances/balance.entity';
import { WebhookEventType } from './dto/webhook.dto';
import { DataSource } from 'typeorm';

describe('SyncService', () => {
  let service: SyncService;
  let balancesService: BalancesService;
  let hcmService: HcmService;
  let module: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        HttpModule,
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Balance],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Balance]),
      ],
      providers: [SyncService, BalancesService, HcmService],
    }).compile();

    service = module.get<SyncService>(SyncService);
    balancesService = module.get<BalancesService>(BalancesService);
    hcmService = module.get<HcmService>(HcmService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM balances');
    jest.restoreAllMocks();
  });

  describe('batchSync', () => {
    it('should create new balances from batch', async () => {
      const result = await service.batchSync({
        records: [
          { employeeId: 'emp-1', locationId: 'loc-1', totalDays: 20 },
          { employeeId: 'emp-2', locationId: 'loc-1', totalDays: 15 },
        ],
      });

      expect(result.created).toBe(2);
      expect(result.updated).toBe(0);

      const balance = await balancesService.findByEmployeeAndLocation('emp-1', 'loc-1');
      expect(Number(balance!.totalDays)).toBe(20);
    });

    it('should update existing balances from batch', async () => {
      await balancesService.upsertFromHcm('emp-1', 'loc-1', 10);

      const result = await service.batchSync({
        records: [
          { employeeId: 'emp-1', locationId: 'loc-1', totalDays: 25 },
        ],
      });

      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);

      const balance = await balancesService.findByEmployeeAndLocation('emp-1', 'loc-1');
      expect(Number(balance!.totalDays)).toBe(25);
    });

    it('should not overwrite pendingDays or usedDays during batch sync', async () => {
      await balancesService.upsertFromHcm('emp-1', 'loc-1', 20);
      await balancesService.reservePendingDays('emp-1', 'loc-1', 5);

      await service.batchSync({
        records: [
          { employeeId: 'emp-1', locationId: 'loc-1', totalDays: 25 },
        ],
      });

      const balance = await balancesService.findByEmployeeAndLocation('emp-1', 'loc-1');
      expect(Number(balance!.totalDays)).toBe(25);
      expect(Number(balance!.pendingDays)).toBe(5);
    });

    it('should handle empty batch', async () => {
      const result = await service.batchSync({ records: [] });
      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
    });
  });

  describe('syncEmployee', () => {
    it('should sync a single location from HCM', async () => {
      jest.spyOn(hcmService, 'getBalance').mockResolvedValue({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        totalDays: 20,
        version: 'v2',
      });

      const balance = await service.syncEmployee('emp-1', 'loc-1');

      expect(Array.isArray(balance)).toBe(false);
      expect(Number((balance as Balance).totalDays)).toBe(20);
      expect(hcmService.getBalance).toHaveBeenCalledWith('emp-1', 'loc-1');
    });

    it('should sync all known locations when locationId is not provided', async () => {
      await balancesService.upsertFromHcm('emp-1', 'loc-1', 10);
      await balancesService.upsertFromHcm('emp-1', 'loc-2', 15);

      jest.spyOn(hcmService, 'getBalance')
        .mockResolvedValueOnce({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          totalDays: 20,
          version: 'v2',
        })
        .mockResolvedValueOnce({
          employeeId: 'emp-1',
          locationId: 'loc-2',
          totalDays: 25,
          version: 'v2',
        });

      const balances = await service.syncEmployee('emp-1');

      expect(Array.isArray(balances)).toBe(true);
      expect((balances as Balance[]).length).toBe(2);
    });

    it('should continue syncing other locations if one fails', async () => {
      await balancesService.upsertFromHcm('emp-1', 'loc-1', 10);
      await balancesService.upsertFromHcm('emp-1', 'loc-2', 15);

      jest.spyOn(hcmService, 'getBalance')
        .mockRejectedValueOnce(new Error('HCM down for loc-1'))
        .mockResolvedValueOnce({
          employeeId: 'emp-1',
          locationId: 'loc-2',
          totalDays: 25,
          version: 'v2',
        });

      const balances = await service.syncEmployee('emp-1');

      expect((balances as Balance[]).length).toBe(1);
      expect(Number((balances as Balance[])[0].totalDays)).toBe(25);
    });

    it('should return empty array if employee has no known balances', async () => {
      const balances = await service.syncEmployee('emp-unknown');
      expect(balances).toEqual([]);
    });
  });

  describe('handleWebhook', () => {
    it('should process BALANCE_UPDATED event', async () => {
      const result = await service.handleWebhook({
        eventType: WebhookEventType.BALANCE_UPDATED,
        employeeId: 'emp-1',
        locationId: 'loc-1',
        totalDays: 20,
        hcmVersion: 'v3',
      });

      expect(result.acknowledged).toBe(true);
      expect(Number(result.balance.totalDays)).toBe(20);
    });

    it('should process BALANCE_RESET event', async () => {
      await balancesService.upsertFromHcm('emp-1', 'loc-1', 10);

      const result = await service.handleWebhook({
        eventType: WebhookEventType.BALANCE_RESET,
        employeeId: 'emp-1',
        locationId: 'loc-1',
        totalDays: 25,
      });

      expect(result.acknowledged).toBe(true);
      expect(Number(result.balance.totalDays)).toBe(25);
    });

    it('should preserve pendingDays on webhook update', async () => {
      await balancesService.upsertFromHcm('emp-1', 'loc-1', 20);
      await balancesService.reservePendingDays('emp-1', 'loc-1', 3);

      const result = await service.handleWebhook({
        eventType: WebhookEventType.BALANCE_UPDATED,
        employeeId: 'emp-1',
        locationId: 'loc-1',
        totalDays: 25,
      });

      expect(Number(result.balance.totalDays)).toBe(25);
      expect(Number(result.balance.pendingDays)).toBe(3);
    });
  });
});
