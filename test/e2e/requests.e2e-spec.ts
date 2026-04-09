import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { MockHcmServer } from '../mock-hcm/mock-hcm.server';
import { DataSource } from 'typeorm';
import { RequestStatus } from '../../src/requests/request-status.enum';

describe('RequestsController (e2e)', () => {
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

  async function seedBalance(
    employeeId: string,
    locationId: string,
    totalDays: number,
  ) {
    mockHcm.seedBalance(employeeId, locationId, totalDays);
    await request(app.getHttpServer())
      .post('/sync/batch')
      .send({ records: [{ employeeId, locationId, totalDays }] });
  }

  // ── Creation ──────────────────────────────────────────────────────────

  describe('POST /time-off-requests', () => {
    it('should create a request and reserve pending days', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const res = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
          reason: 'Vacation',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe(RequestStatus.PENDING);
      expect(res.body.employeeId).toBe('emp-1');
      expect(Number(res.body.numberOfDays)).toBe(2);

      const balanceRes = await request(app.getHttpServer())
        .get('/balances/emp-1/loc-1')
        .expect(200);
      expect(Number(balanceRes.body.pendingDays)).toBe(2);
    });

    it('should reject when balance is insufficient', async () => {
      await seedBalance('emp-1', 'loc-1', 5);

      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-10',
          numberOfDays: 10,
        })
        .expect(409);
    });

    it('should reject when no balance exists and HCM is unavailable', async () => {
      mockHcm.shouldFailGetBalance = true;

      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-unknown',
          locationId: 'loc-unknown',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 1,
        })
        .expect(404);
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({})
        .expect(400);
    });

    it('should reject when start date is after end date', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-10',
          endDate: '2025-07-01',
          numberOfDays: 2,
        })
        .expect(400);
    });

    it('should prevent double-booking via pending days tracking', async () => {
      await seedBalance('emp-1', 'loc-1', 10);

      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-06',
          numberOfDays: 6,
        })
        .expect(201);

      // Only 4 days left, so 6 should fail
      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-08-01',
          endDate: '2025-08-06',
          numberOfDays: 6,
        })
        .expect(409);

      // But 4 days should succeed
      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-08-01',
          endDate: '2025-08-04',
          numberOfDays: 4,
        })
        .expect(201);
    });

    it('should sync from HCM when balance has been updated externally', async () => {
      await seedBalance('emp-1', 'loc-1', 10);
      mockHcm.updateBalance('emp-1', 'loc-1', 15);

      // Request for 12 days: local has 10, but HCM has 15 — should succeed
      const res = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-12',
          numberOfDays: 12,
        })
        .expect(201);

      expect(res.body.status).toBe(RequestStatus.PENDING);
    });

    it('should fall back to local balance when HCM is unavailable', async () => {
      await seedBalance('emp-1', 'loc-1', 10);
      mockHcm.shouldFailGetBalance = true;

      const res = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        })
        .expect(201);

      expect(res.body.status).toBe(RequestStatus.PENDING);
    });

    it('should reject numberOfDays less than 0.5', async () => {
      await seedBalance('emp-1', 'loc-1', 10);

      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-01',
          numberOfDays: 0.1,
        })
        .expect(400);
    });
  });

  // ── Querying ──────────────────────────────────────────────────────────

  describe('GET /time-off-requests', () => {
    it('should return all requests', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        });

      const res = await request(app.getHttpServer())
        .get('/time-off-requests')
        .expect(200);

      expect(res.body).toHaveLength(1);
    });

    it('should filter by employeeId', async () => {
      await seedBalance('emp-1', 'loc-1', 20);
      await seedBalance('emp-2', 'loc-1', 20);

      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        });

      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-2',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        });

      const res = await request(app.getHttpServer())
        .get('/time-off-requests?employeeId=emp-1')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].employeeId).toBe('emp-1');
    });

    it('should filter by status', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const createRes = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        });

      await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/reject`)
        .send({ reviewedBy: 'mgr-1' });

      const pendingRes = await request(app.getHttpServer())
        .get('/time-off-requests?status=PENDING')
        .expect(200);
      expect(pendingRes.body).toHaveLength(0);

      const rejectedRes = await request(app.getHttpServer())
        .get('/time-off-requests?status=REJECTED')
        .expect(200);
      expect(rejectedRes.body).toHaveLength(1);
    });
  });

  describe('GET /time-off-requests/:id', () => {
    it('should return a specific request', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const createRes = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        });

      const res = await request(app.getHttpServer())
        .get(`/time-off-requests/${createRes.body.id}`)
        .expect(200);

      expect(res.body.id).toBe(createRes.body.id);
    });

    it('should return 404 for non-existent request', () => {
      return request(app.getHttpServer())
        .get('/time-off-requests/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('should return 400 for invalid UUID', () => {
      return request(app.getHttpServer())
        .get('/time-off-requests/not-a-uuid')
        .expect(400);
    });
  });

  // ── Approval ──────────────────────────────────────────────────────────

  describe('PATCH /time-off-requests/:id/approve', () => {
    it('should approve a request and confirm with HCM', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const createRes = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        });

      const res = await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/approve`)
        .send({ reviewedBy: 'manager-1' })
        .expect(200);

      expect(res.body.status).toBe(RequestStatus.APPROVED);
      expect(res.body.reviewedBy).toBe('manager-1');
      expect(res.body.hcmReferenceId).toBeDefined();

      const balanceRes = await request(app.getHttpServer())
        .get('/balances/emp-1/loc-1')
        .expect(200);
      expect(Number(balanceRes.body.pendingDays)).toBe(0);
      expect(Number(balanceRes.body.usedDays)).toBe(2);
    });

    it('should mark as HCM_REJECTED when HCM rejects', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const createRes = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        });

      mockHcm.rejectNextSubmission = true;
      mockHcm.rejectReason = 'Employee is in a blackout period';

      const res = await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/approve`)
        .send({ reviewedBy: 'manager-1' })
        .expect(200);

      expect(res.body.status).toBe(RequestStatus.HCM_REJECTED);
      expect(res.body.hcmErrorMessage).toContain('blackout period');

      const balanceRes = await request(app.getHttpServer())
        .get('/balances/emp-1/loc-1')
        .expect(200);
      expect(Number(balanceRes.body.pendingDays)).toBe(0);
      expect(Number(balanceRes.body.usedDays)).toBe(0);
    });

    it('should mark as HCM_REJECTED when HCM is unavailable', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const createRes = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        });

      mockHcm.shouldFailSubmitTimeOff = true;

      const res = await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/approve`)
        .send({ reviewedBy: 'manager-1' })
        .expect(200);

      expect(res.body.status).toBe(RequestStatus.HCM_REJECTED);
      expect(res.body.hcmErrorMessage).toBeDefined();
    });

    it('should not allow approving a non-PENDING request', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const createRes = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        });

      await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/reject`)
        .send({ reviewedBy: 'manager-1' });

      await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/approve`)
        .send({ reviewedBy: 'manager-1' })
        .expect(400);
    });

    it('should require reviewedBy field', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const createRes = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        });

      await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/approve`)
        .send({})
        .expect(400);
    });
  });

  // ── Rejection ─────────────────────────────────────────────────────────

  describe('PATCH /time-off-requests/:id/reject', () => {
    it('should reject a request and release pending days', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const createRes = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        });

      const res = await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/reject`)
        .send({ reviewedBy: 'manager-1' })
        .expect(200);

      expect(res.body.status).toBe(RequestStatus.REJECTED);

      const balanceRes = await request(app.getHttpServer())
        .get('/balances/emp-1/loc-1')
        .expect(200);
      expect(Number(balanceRes.body.pendingDays)).toBe(0);
    });

    it('should not allow rejecting a non-PENDING request', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const createRes = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        });

      await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/approve`)
        .send({ reviewedBy: 'manager-1' });

      await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/reject`)
        .send({ reviewedBy: 'manager-1' })
        .expect(400);
    });
  });

  // ── Cancellation ──────────────────────────────────────────────────────

  describe('PATCH /time-off-requests/:id/cancel', () => {
    it('should cancel a PENDING request and release pending days', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const createRes = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        });

      const res = await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/cancel`)
        .expect(200);

      expect(res.body.status).toBe(RequestStatus.CANCELLED);

      const balanceRes = await request(app.getHttpServer())
        .get('/balances/emp-1/loc-1')
        .expect(200);
      expect(Number(balanceRes.body.pendingDays)).toBe(0);
    });

    it('should cancel an APPROVED request and reverse used days via HCM', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const createRes = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        });

      await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/approve`)
        .send({ reviewedBy: 'manager-1' });

      const res = await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/cancel`)
        .expect(200);

      expect(res.body.status).toBe(RequestStatus.CANCELLED);

      const balanceRes = await request(app.getHttpServer())
        .get('/balances/emp-1/loc-1')
        .expect(200);
      expect(Number(balanceRes.body.usedDays)).toBe(0);
    });

    it('should fail to cancel APPROVED request if HCM cancellation fails', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const createRes = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        });

      await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/approve`)
        .send({ reviewedBy: 'manager-1' });

      mockHcm.shouldFailCancelTimeOff = true;

      await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/cancel`)
        .expect(409);
    });

    it('should not allow cancelling a REJECTED request', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const createRes = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        });

      await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/reject`)
        .send({ reviewedBy: 'manager-1' });

      await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/cancel`)
        .expect(400);
    });
  });

  // ── Full Lifecycle ────────────────────────────────────────────────────

  describe('Full lifecycle tests', () => {
    it('complete happy path: create → approve → confirmed', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const createRes = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-05',
          numberOfDays: 5,
          reason: 'Summer vacation',
        })
        .expect(201);

      expect(createRes.body.status).toBe(RequestStatus.PENDING);

      let balanceRes = await request(app.getHttpServer()).get(
        '/balances/emp-1/loc-1',
      );
      expect(Number(balanceRes.body.pendingDays)).toBe(5);
      expect(Number(balanceRes.body.usedDays)).toBe(0);

      const approveRes = await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/approve`)
        .send({ reviewedBy: 'manager-1' })
        .expect(200);

      expect(approveRes.body.status).toBe(RequestStatus.APPROVED);
      expect(approveRes.body.hcmReferenceId).toBeTruthy();

      balanceRes = await request(app.getHttpServer()).get(
        '/balances/emp-1/loc-1',
      );
      expect(Number(balanceRes.body.pendingDays)).toBe(0);
      expect(Number(balanceRes.body.usedDays)).toBe(5);
      expect(Number(balanceRes.body.totalDays)).toBe(20);
    });

    it('create → cancel flow restores full balance', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const createRes = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-02',
          numberOfDays: 2,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/time-off-requests/${createRes.body.id}/cancel`)
        .expect(200);

      const balanceRes = await request(app.getHttpServer()).get(
        '/balances/emp-1/loc-1',
      );
      expect(Number(balanceRes.body.pendingDays)).toBe(0);
      expect(Number(balanceRes.body.usedDays)).toBe(0);
    });

    it('multiple requests: approve, reject, cancel', async () => {
      await seedBalance('emp-1', 'loc-1', 20);

      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const res = await request(app.getHttpServer())
          .post('/time-off-requests')
          .send({
            employeeId: 'emp-1',
            locationId: 'loc-1',
            startDate: `2025-0${7 + i}-01`,
            endDate: `2025-0${7 + i}-05`,
            numberOfDays: 5,
          })
          .expect(201);
        ids.push(res.body.id);
      }

      let balanceRes = await request(app.getHttpServer()).get(
        '/balances/emp-1/loc-1',
      );
      expect(Number(balanceRes.body.pendingDays)).toBe(15);

      await request(app.getHttpServer())
        .patch(`/time-off-requests/${ids[0]}/approve`)
        .send({ reviewedBy: 'mgr-1' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/time-off-requests/${ids[1]}/reject`)
        .send({ reviewedBy: 'mgr-1' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/time-off-requests/${ids[2]}/cancel`)
        .expect(200);

      balanceRes = await request(app.getHttpServer()).get(
        '/balances/emp-1/loc-1',
      );
      expect(Number(balanceRes.body.usedDays)).toBe(5);
      expect(Number(balanceRes.body.pendingDays)).toBe(0);
    });

    it('HCM balance update (work anniversary) preserves pending days', async () => {
      await seedBalance('emp-1', 'loc-1', 10);

      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'emp-1',
          locationId: 'loc-1',
          startDate: '2025-07-01',
          endDate: '2025-07-08',
          numberOfDays: 8,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/sync/webhook')
        .send({
          eventType: 'BALANCE_UPDATED',
          employeeId: 'emp-1',
          locationId: 'loc-1',
          totalDays: 15,
        })
        .expect(201);

      const balanceRes = await request(app.getHttpServer()).get(
        '/balances/emp-1/loc-1',
      );
      expect(Number(balanceRes.body.totalDays)).toBe(15);
      expect(Number(balanceRes.body.pendingDays)).toBe(8);
    });
  });
});
