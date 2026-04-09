import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { MockHcmServer } from '../mock-hcm/mock-hcm.server';
import { DataSource } from 'typeorm';

describe('BalancesController (e2e)', () => {
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
    await dataSource.query('DELETE FROM balances');
    mockHcm.reset();
  });

  describe('GET /balances/:employeeId', () => {
    it('should return empty array when no balances exist', () => {
      return request(app.getHttpServer())
        .get('/balances/emp-1')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual([]);
        });
    });

    it('should return all balances for an employee', async () => {
      await request(app.getHttpServer())
        .post('/sync/batch')
        .send({
          records: [
            { employeeId: 'emp-1', locationId: 'loc-1', totalDays: 20 },
            { employeeId: 'emp-1', locationId: 'loc-2', totalDays: 10 },
          ],
        })
        .expect(201);

      return request(app.getHttpServer())
        .get('/balances/emp-1')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(2);
          expect(res.body[0].employeeId).toBe('emp-1');
          expect(res.body[1].employeeId).toBe('emp-1');
        });
    });
  });

  describe('GET /balances/:employeeId/:locationId', () => {
    it('should return 404 when balance does not exist', () => {
      return request(app.getHttpServer())
        .get('/balances/emp-1/loc-1')
        .expect(404);
    });

    it('should return the balance for a specific employee-location pair', async () => {
      await request(app.getHttpServer())
        .post('/sync/batch')
        .send({
          records: [
            { employeeId: 'emp-1', locationId: 'loc-1', totalDays: 15 },
          ],
        })
        .expect(201);

      return request(app.getHttpServer())
        .get('/balances/emp-1/loc-1')
        .expect(200)
        .expect((res) => {
          expect(res.body.employeeId).toBe('emp-1');
          expect(res.body.locationId).toBe('loc-1');
          expect(Number(res.body.totalDays)).toBe(15);
          expect(Number(res.body.usedDays)).toBe(0);
          expect(Number(res.body.pendingDays)).toBe(0);
        });
    });
  });
});
