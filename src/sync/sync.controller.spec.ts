import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { WebhookEventType } from './dto/webhook.dto';

describe('SyncController', () => {
  let controller: SyncController;
  let service: Partial<SyncService>;

  beforeEach(() => {
    service = {
      batchSync: jest.fn().mockResolvedValue({ created: 2, updated: 1 }),
      syncEmployee: jest.fn().mockResolvedValue({ id: 1, totalDays: 20 }),
      handleWebhook: jest.fn().mockResolvedValue({ acknowledged: true, balance: { totalDays: 20 } }),
    };
    controller = new SyncController(service as SyncService);
  });

  describe('batchSync', () => {
    it('should delegate to service.batchSync', async () => {
      const dto = {
        records: [
          { employeeId: 'emp-1', locationId: 'loc-1', totalDays: 20 },
        ],
      };
      const result = await controller.batchSync(dto);

      expect(result).toEqual({ created: 2, updated: 1 });
      expect(service.batchSync).toHaveBeenCalledWith(dto);
    });
  });

  describe('syncEmployee', () => {
    it('should delegate to service.syncEmployee with locationId', async () => {
      await controller.syncEmployee('emp-1', 'loc-1');

      expect(service.syncEmployee).toHaveBeenCalledWith('emp-1', 'loc-1');
    });

    it('should delegate to service.syncEmployee without locationId', async () => {
      await controller.syncEmployee('emp-1', undefined);

      expect(service.syncEmployee).toHaveBeenCalledWith('emp-1', undefined);
    });
  });

  describe('webhook', () => {
    it('should delegate to service.handleWebhook', async () => {
      const dto = {
        eventType: WebhookEventType.BALANCE_UPDATED,
        employeeId: 'emp-1',
        locationId: 'loc-1',
        totalDays: 20,
      };
      const result = await controller.webhook(dto);

      expect(result).toEqual({ acknowledged: true, balance: { totalDays: 20 } });
      expect(service.handleWebhook).toHaveBeenCalledWith(dto);
    });
  });
});
