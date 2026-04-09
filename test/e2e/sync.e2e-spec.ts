import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { MockHcmServer } from '../mock-hcm/mock-hcm.server';
import { DataSource } from 'typeorm';

describe('SyncController (e2e)', () => {
  let app: INestApplication;
  let mockHcm: MockHcmServer;
  let dataSource: DataSource;

  beforeAll(async () => {
    mockHcm = new MockHcmServer(0);
    const port = await mockHcm.start();

    process.env.HCM_BASE_URL = `http://localhost:${port}`;
    process.env.DATABASE_PATH = ':memory:';
    process.env.SYNC_API_KEY = '';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
    await mockHcm.stop();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM time_off_requests');
    await dataSource.query('DELETE FROM balances');
    mockHcm.reset();
  });

  describe('POST /sync/batch', () => {
    it('should create balances from batch data', async () => {
      const res = await request(app.getHttpServer())
        .post('/sync/batch')
        .send({
          records: [
            { employeeId: 'emp-1', locationId: 'loc-1', totalDays: 20 },
            { employeeId: 'emp-1', locationId: 'loc-2', totalDays: 10 },
            { employeeId: 'emp-2', locationId: 'loc-1', totalDays: 15 },
          ],
        })
        .expect(201);

      expect(res.body.created).toBe(3);
      expect(res.body.updated).toBe(0);
    });

    it('should update existing balances (totalDays only)', async () => {
      await request(app.getHttpServer())
        .post('/sync/batch')
        .send({
          records: [
            { employeeId: 'emp-1', locationId: 'loc-1', totalDays: 20 },
          ],
        });

      const res = await request(app.getHttpServer())
        .post('/sync/batch')
        .send({
          records: [
            { employeeId: 'emp-1', locationId: 'loc-1', totalDays: 25 },
          ],
        })
        .expect(201);

      expect(res.body.updated).toBe(1);
      expect(res.body.created).toBe(0);

      const balanceRes = await request(app.getHttpServer())
        .get('/balances/emp-1/loc-1')
        .expect(200);
      expect(Number(balanceRes.body.totalDays)).toBe(25);
    });

    it('should NOT overwrite pendingDays during batch sync', async () => {
      mockHcm.seedBalance('emp-1', 'loc-1', 20);
      await request(app.getHttpServer())
        .post('/sync/batch')
        .send({
          records: [
            { employeeId: 'emp-1', locationId: 'loc-1', totalDays: 20 },
          ],
        });

      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-03',
          numberOfDays: 3,
        });

      await request(app.getHttpServer())
        .post('/sync/batch')
        .send({
          records: [
            { employeeId: 'emp-1', locationId: 'loc-1', totalDays: 25 },
          ],
        });

      const balanceRes = await request(app.getHttpServer())
        .get('/balances/emp-1/loc-1')
        .expect(200);

      expect(Number(balanceRes.body.totalDays)).toBe(25);
      expect(Number(balanceRes.body.pendingDays)).toBe(3);
    });

    it('should validate batch input', async () => {
      await request(app.getHttpServer())
        .post('/sync/batch')
        .send({
          records: [
            { employeeId: '', locationId: 'loc-1', totalDays: -5 },
          ],
        })
        .expect(400);
    });
  });

  describe('POST /sync/employee/:employeeId', () => {
    it('should sync a specific employee-location from HCM', async () => {
      mockHcm.seedBalance('emp-1', 'loc-1', 20);

      const res = await request(app.getHttpServer())
        .post('/sync/employee/emp-1?locationId=loc-1')
        .expect(201);

      expect(Number(res.body.totalDays)).toBe(20);
      expect(res.body.hcmLastSyncedAt).toBeDefined();
    });

    it('should sync all known locations for an employee', async () => {
      await request(app.getHttpServer())
        .post('/sync/batch')
        .send({
          records: [
            { employeeId: 'emp-1', locationId: 'loc-1', totalDays: 10 },
            { employeeId: 'emp-1', locationId: 'loc-2', totalDays: 5 },
          ],
        });

      mockHcm.seedBalance('emp-1', 'loc-1', 15);
      mockHcm.seedBalance('emp-1', 'loc-2', 8);

      const res = await request(app.getHttpServer())
        .post('/sync/employee/emp-1')
        .expect(201);

      expect(res.body).toHaveLength(2);
    });

    it('should handle HCM failure during employee sync', async () => {
      mockHcm.shouldFailGetBalance = true;

      await request(app.getHttpServer())
        .post('/sync/employee/emp-1?locationId=loc-1')
        .expect(500);
    });
  });

  describe('POST /sync/webhook', () => {
    it('should handle BALANCE_UPDATED webhook', async () => {
      const res = await request(app.getHttpServer())
        .post('/sync/webhook')
        .send({
          eventType: 'BALANCE_UPDATED',
          employeeId: 'emp-1',
          locationId: 'loc-1',
          totalDays: 20,
          hcmVersion: 'v123',
        })
        .expect(201);

      expect(res.body.acknowledged).toBe(true);
      expect(Number(res.body.balance.totalDays)).toBe(20);
    });

    it('should handle BALANCE_RESET webhook', async () => {
      await request(app.getHttpServer())
        .post('/sync/batch')
        .send({
          records: [
            { employeeId: 'emp-1', locationId: 'loc-1', totalDays: 20 },
          ],
        });

      const res = await request(app.getHttpServer())
        .post('/sync/webhook')
        .send({
          eventType: 'BALANCE_RESET',
          employeeId: 'emp-1',
          locationId: 'loc-1',
          totalDays: 25,
        })
        .expect(201);

      expect(res.body.acknowledged).toBe(true);
      expect(Number(res.body.balance.totalDays)).toBe(25);
    });

    it('should validate webhook input', async () => {
      await request(app.getHttpServer())
        .post('/sync/webhook')
        .send({
          eventType: 'INVALID_EVENT',
          employeeId: 'emp-1',
          locationId: 'loc-1',
          totalDays: 20,
        })
        .expect(400);
    });
  });
});
