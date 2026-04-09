import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { HcmService } from './hcm.service';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';

describe('HcmService', () => {
  let service: HcmService;
  let httpService: HttpService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        HttpModule,
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              HCM_BASE_URL: 'http://localhost:3001',
              HCM_API_KEY: 'test-key',
            }),
          ],
        }),
      ],
      providers: [HcmService],
    }).compile();

    service = module.get<HcmService>(HcmService);
    httpService = module.get<HttpService>(HttpService);
  });

  function mockAxiosResponse<T>(data: T): AxiosResponse<T> {
    return {
      data,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {
        headers: new AxiosHeaders(),
      } as InternalAxiosRequestConfig,
    };
  }

  describe('getBalance', () => {
    it('should return balance data from HCM', async () => {
      const mockData = {
        employeeId: 'emp-1',
        locationId: 'loc-1',
        totalDays: 20,
        version: 'v1',
      };
      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(of(mockAxiosResponse(mockData)));

      const result = await service.getBalance('emp-1', 'loc-1');

      expect(result).toEqual(mockData);
      expect(httpService.get).toHaveBeenCalledWith(
        'http://localhost:3001/api/balances/emp-1/loc-1',
        expect.objectContaining({ timeout: 5000 }),
      );
    });

    it('should throw when HCM returns error', async () => {
      jest
        .spyOn(httpService, 'get')
        .mockReturnValue(
          throwError(() => new Error('Connection refused')),
        );

      await expect(
        service.getBalance('emp-1', 'loc-1'),
      ).rejects.toThrow('Connection refused');
    });
  });

  describe('submitTimeOff', () => {
    it('should submit time-off and return response', async () => {
      const mockResponse = {
        referenceId: 'HCM-REF-1',
        status: 'APPROVED',
      };
      jest
        .spyOn(httpService, 'post')
        .mockReturnValue(of(mockAxiosResponse(mockResponse)));

      const result = await service.submitTimeOff({
        employeeId: 'emp-1',
        locationId: 'loc-1',
        startDate: '2025-07-01',
        endDate: '2025-07-02',
        numberOfDays: 2,
      });

      expect(result.referenceId).toBe('HCM-REF-1');
    });

    it('should throw when HCM rejects submission', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(
        throwError(() => new Error('Insufficient balance')),
      );

      await expect(
        service.submitTimeOff({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        }),
      ).rejects.toThrow();
    });
  });

  describe('cancelTimeOff', () => {
    it('should cancel time-off in HCM', async () => {
      jest
        .spyOn(httpService, 'delete')
        .mockReturnValue(
          of(mockAxiosResponse({ status: 'CANCELLED' })),
        );

      await expect(
        service.cancelTimeOff('HCM-REF-1'),
      ).resolves.not.toThrow();
    });

    it('should throw when HCM cancellation fails', async () => {
      jest
        .spyOn(httpService, 'delete')
        .mockReturnValue(throwError(() => new Error('Not found')));

      await expect(
        service.cancelTimeOff('HCM-REF-INVALID'),
      ).rejects.toThrow();
    });
  });
});
