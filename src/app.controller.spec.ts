import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(() => {
    controller = new AppController();
  });

  describe('root', () => {
    it('should return HTML landing page', () => {
      const result = controller.root();

      expect(typeof result).toBe('string');
      expect(result).toContain('Time-Off');
      expect(result).toContain('Microservice');
      expect(result).toContain('/api/docs');
      expect(result).toContain('/health');
      expect(result).toContain('/time-off-requests');
      expect(result).toContain('/sync/batch');
    });
  });

  describe('healthCheck', () => {
    it('should return health status', () => {
      const result = controller.healthCheck();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('service', 'time-off-service');
      expect(result).toHaveProperty('timestamp');
    });
  });
});
