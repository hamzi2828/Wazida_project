import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { MockHcmServer } from '../mock-hcm/mock-hcm.server';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let mockHcm: MockHcmServer;

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
  });

  afterAll(async () => {
    await app.close();
    await mockHcm.stop();
  });

  it('/health (GET) should return service status', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('time-off-service');
        expect(res.body.timestamp).toBeDefined();
      });
  });
});
