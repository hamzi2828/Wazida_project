import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalancesService } from './balances.service';
import { Balance } from './balance.entity';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

describe('BalancesService', () => {
  let service: BalancesService;
  let module: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Balance],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Balance]),
      ],
      providers: [BalancesService],
    }).compile();

    service = module.get<BalancesService>(BalancesService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM balances');
  });

  describe('upsertFromHcm', () => {
    it('should create a new balance record', async () => {
      const balance = await service.upsertFromHcm('emp-1', 'loc-1', 20, 'v1');

      expect(balance.employeeId).toBe('emp-1');
      expect(balance.locationId).toBe('loc-1');
      expect(Number(balance.totalDays)).toBe(20);
      expect(Number(balance.usedDays)).toBe(0);
      expect(Number(balance.pendingDays)).toBe(0);
      expect(balance.hcmVersion).toBe('v1');
      expect(balance.hcmLastSyncedAt).toBeDefined();
    });

    it('should update only totalDays for existing balance', async () => {
      await service.upsertFromHcm('emp-1', 'loc-1', 20, 'v1');
      await service.reservePendingDays('emp-1', 'loc-1', 5);

      const updated = await service.upsertFromHcm(
        'emp-1',
        'loc-1',
        25,
        'v2',
      );

      expect(Number(updated.totalDays)).toBe(25);
      expect(Number(updated.pendingDays)).toBe(5);
      expect(updated.hcmVersion).toBe('v2');
    });
  });

  describe('reservePendingDays', () => {
    it('should increment pending days', async () => {
      await service.upsertFromHcm('emp-1', 'loc-1', 20);

      const balance = await service.reservePendingDays('emp-1', 'loc-1', 3);
      expect(Number(balance.pendingDays)).toBe(3);

      const balance2 = await service.reservePendingDays('emp-1', 'loc-1', 2);
      expect(Number(balance2.pendingDays)).toBe(5);
    });

    it('should throw NotFoundException for non-existent balance', async () => {
      await expect(
        service.reservePendingDays('no-emp', 'no-loc', 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('releasePendingDays', () => {
    it('should decrement pending days', async () => {
      await service.upsertFromHcm('emp-1', 'loc-1', 20);
      await service.reservePendingDays('emp-1', 'loc-1', 5);

      const balance = await service.releasePendingDays('emp-1', 'loc-1', 3);
      expect(Number(balance.pendingDays)).toBe(2);
    });

    it('should not go below zero', async () => {
      await service.upsertFromHcm('emp-1', 'loc-1', 20);
      await service.reservePendingDays('emp-1', 'loc-1', 2);

      const balance = await service.releasePendingDays('emp-1', 'loc-1', 5);
      expect(Number(balance.pendingDays)).toBe(0);
    });
  });

  describe('confirmDays', () => {
    it('should move days from pending to used', async () => {
      await service.upsertFromHcm('emp-1', 'loc-1', 20);
      await service.reservePendingDays('emp-1', 'loc-1', 5);

      const balance = await service.confirmDays('emp-1', 'loc-1', 5);
      expect(Number(balance.pendingDays)).toBe(0);
      expect(Number(balance.usedDays)).toBe(5);
    });
  });

  describe('reverseDays', () => {
    it('should decrement used days', async () => {
      await service.upsertFromHcm('emp-1', 'loc-1', 20);
      await service.reservePendingDays('emp-1', 'loc-1', 5);
      await service.confirmDays('emp-1', 'loc-1', 5);

      const balance = await service.reverseDays('emp-1', 'loc-1', 5);
      expect(Number(balance.usedDays)).toBe(0);
    });

    it('should not go below zero', async () => {
      await service.upsertFromHcm('emp-1', 'loc-1', 20);

      const balance = await service.reverseDays('emp-1', 'loc-1', 5);
      expect(Number(balance.usedDays)).toBe(0);
    });
  });

  describe('batchUpsert', () => {
    it('should create multiple balance records', async () => {
      const result = await service.batchUpsert([
        { employeeId: 'emp-1', locationId: 'loc-1', totalDays: 20 },
        { employeeId: 'emp-1', locationId: 'loc-2', totalDays: 10 },
        { employeeId: 'emp-2', locationId: 'loc-1', totalDays: 15 },
      ]);

      expect(result.created).toBe(3);
      expect(result.updated).toBe(0);
    });

    it('should track updates vs creates correctly', async () => {
      await service.upsertFromHcm('emp-1', 'loc-1', 20);

      const result = await service.batchUpsert([
        { employeeId: 'emp-1', locationId: 'loc-1', totalDays: 25 },
        { employeeId: 'emp-2', locationId: 'loc-1', totalDays: 15 },
      ]);

      expect(result.created).toBe(1);
      expect(result.updated).toBe(1);
    });
  });

  describe('findByEmployeeAndLocationOrFail', () => {
    it('should throw NotFoundException when not found', async () => {
      await expect(
        service.findByEmployeeAndLocationOrFail('no-emp', 'no-loc'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return balance when found', async () => {
      await service.upsertFromHcm('emp-1', 'loc-1', 20);

      const balance = await service.findByEmployeeAndLocationOrFail(
        'emp-1',
        'loc-1',
      );
      expect(balance.employeeId).toBe('emp-1');
    });
  });
});
