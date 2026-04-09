import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { RequestsService } from './requests.service';
import { TimeOffRequest } from './time-off-request.entity';
import { RequestStatus } from './request-status.enum';
import { Balance } from '../balances/balance.entity';
import { BalancesService } from '../balances/balances.service';
import { HcmService } from '../hcm/hcm.service';
import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

describe('RequestsService', () => {
  let service: RequestsService;
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
          entities: [TimeOffRequest, Balance],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([TimeOffRequest, Balance]),
      ],
      providers: [RequestsService, BalancesService, HcmService],
    }).compile();

    service = module.get<RequestsService>(RequestsService);
    balancesService = module.get<BalancesService>(BalancesService);
    hcmService = module.get<HcmService>(HcmService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM time_off_requests');
    await dataSource.query('DELETE FROM balances');
    jest.restoreAllMocks();
  });

  async function seedBalance(
    employeeId: string,
    locationId: string,
    totalDays: number,
  ) {
    jest.spyOn(hcmService, 'getBalance').mockResolvedValue({
      employeeId,
      locationId,
      totalDays,
      version: 'v1',
    });
    await balancesService.upsertFromHcm(
      employeeId,
      locationId,
      totalDays,
      'v1',
    );
  }

  describe('create', () => {
    it('should create a request when balance is sufficient', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const result = await service.create({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        startDate: '2025-07-01',
        endDate: '2025-07-03',
        numberOfDays: 3,
      });

      expect(result.status).toBe(RequestStatus.PENDING);
      expect(result.employeeId).toBe('emp-1');
      expect(Number(result.numberOfDays)).toBe(3);

      const balance = await balancesService.findByEmployeeAndLocation(
        'emp-1',
        'loc-1',
      );
      expect(Number(balance!.pendingDays)).toBe(3);
    });

    it('should throw ConflictException when balance is insufficient', async () => {
      await seedBalance('emp-1', 'loc-1', 5);

      await expect(
        service.create({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-10',
          numberOfDays: 10,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when startDate > endDate', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      await expect(
        service.create({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-10',
          endDate: '2025-07-01',
          numberOfDays: 2,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should fall back to local balance when HCM sync fails', async () => {
      await balancesService.upsertFromHcm('emp-1', 'loc-1', 20, 'v1');
      jest
        .spyOn(hcmService, 'getBalance')
        .mockRejectedValue(new Error('HCM down'));

      const result = await service.create({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        startDate: '2025-07-01',
        endDate: '2025-07-02',
        numberOfDays: 2,
      });

      expect(result.status).toBe(RequestStatus.PENDING);
    });
  });

  describe('approve', () => {
    it('should approve and confirm with HCM', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const created = await service.create({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        startDate: '2025-07-01',
        endDate: '2025-07-02',
        numberOfDays: 2,
      });

      jest.spyOn(hcmService, 'submitTimeOff').mockResolvedValue({
        referenceId: 'HCM-REF-1',
        status: 'APPROVED',
      });

      const approved = await service.approve(created.id, 'manager-1');

      expect(approved.status).toBe(RequestStatus.APPROVED);
      expect(approved.hcmReferenceId).toBe('HCM-REF-1');
      expect(approved.reviewedBy).toBe('manager-1');

      const balance = await balancesService.findByEmployeeAndLocation(
        'emp-1',
        'loc-1',
      );
      expect(Number(balance!.usedDays)).toBe(2);
      expect(Number(balance!.pendingDays)).toBe(0);
    });

    it('should set HCM_REJECTED when HCM fails', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const created = await service.create({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        startDate: '2025-07-01',
        endDate: '2025-07-02',
        numberOfDays: 2,
      });

      jest
        .spyOn(hcmService, 'submitTimeOff')
        .mockRejectedValue(new Error('HCM unavailable'));

      const result = await service.approve(created.id, 'manager-1');

      expect(result.status).toBe(RequestStatus.HCM_REJECTED);
      expect(result.hcmErrorMessage).toContain('HCM unavailable');

      const balance = await balancesService.findByEmployeeAndLocation(
        'emp-1',
        'loc-1',
      );
      expect(Number(balance!.pendingDays)).toBe(0);
      expect(Number(balance!.usedDays)).toBe(0);
    });

    it('should throw BadRequestException for non-PENDING requests', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const created = await service.create({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        startDate: '2025-07-01',
        endDate: '2025-07-02',
        numberOfDays: 2,
      });

      await service.reject(created.id, 'manager-1');

      await expect(
        service.approve(created.id, 'manager-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('should reject and release pending days', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const created = await service.create({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        startDate: '2025-07-01',
        endDate: '2025-07-02',
        numberOfDays: 2,
      });

      const rejected = await service.reject(created.id, 'manager-1');

      expect(rejected.status).toBe(RequestStatus.REJECTED);
      expect(rejected.reviewedBy).toBe('manager-1');

      const balance = await balancesService.findByEmployeeAndLocation(
        'emp-1',
        'loc-1',
      );
      expect(Number(balance!.pendingDays)).toBe(0);
    });
  });

  describe('cancel', () => {
    it('should cancel a PENDING request', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const created = await service.create({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        startDate: '2025-07-01',
        endDate: '2025-07-02',
        numberOfDays: 2,
      });

      const cancelled = await service.cancel(created.id);

      expect(cancelled.status).toBe(RequestStatus.CANCELLED);

      const balance = await balancesService.findByEmployeeAndLocation(
        'emp-1',
        'loc-1',
      );
      expect(Number(balance!.pendingDays)).toBe(0);
    });

    it('should cancel APPROVED request and reverse with HCM', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const created = await service.create({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        startDate: '2025-07-01',
        endDate: '2025-07-02',
        numberOfDays: 2,
      });

      jest.spyOn(hcmService, 'submitTimeOff').mockResolvedValue({
        referenceId: 'HCM-REF-1',
        status: 'APPROVED',
      });
      await service.approve(created.id, 'manager-1');

      jest.spyOn(hcmService, 'cancelTimeOff').mockResolvedValue();

      const cancelled = await service.cancel(created.id);

      expect(cancelled.status).toBe(RequestStatus.CANCELLED);
      expect(hcmService.cancelTimeOff).toHaveBeenCalledWith('HCM-REF-1');

      const balance = await balancesService.findByEmployeeAndLocation(
        'emp-1',
        'loc-1',
      );
      expect(Number(balance!.usedDays)).toBe(0);
    });

    it('should throw BadRequestException for REJECTED requests', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const created = await service.create({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        startDate: '2025-07-01',
        endDate: '2025-07-02',
        numberOfDays: 2,
      });

      await service.reject(created.id, 'manager-1');

      await expect(service.cancel(created.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should filter by employeeId', async () => {
      await seedBalance('emp-1', 'loc-1', 20);
      await seedBalance('emp-2', 'loc-1', 20);

      await service.create({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        startDate: '2025-07-01',
        endDate: '2025-07-02',
        numberOfDays: 2,
      });

      jest.spyOn(hcmService, 'getBalance').mockResolvedValue({
        employeeId: 'emp-2',
        locationId: 'loc-1',
        totalDays: 20,
        version: 'v1',
      });

      await service.create({
        employeeId: 'emp-2',
        locationId: 'loc-1',
        startDate: '2025-07-01',
        endDate: '2025-07-02',
        numberOfDays: 2,
      });

      const results = await service.findAll({ employeeId: 'emp-1' });
      expect(results).toHaveLength(1);
      expect(results[0].employeeId).toBe('emp-1');
    });
  });
});
