import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { RequestStatus } from './request-status.enum';

describe('RequestsController', () => {
  let controller: RequestsController;
  let service: Partial<RequestsService>;

  const mockRequest = {
    id: 'uuid-1',
    employeeId: 'emp-1',
    locationId: 'loc-1',
    startDate: '2025-07-01',
    endDate: '2025-07-03',
    numberOfDays: 3,
    status: RequestStatus.PENDING,
  };

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(mockRequest),
      findAll: jest.fn().mockResolvedValue([mockRequest]),
      findOne: jest.fn().mockResolvedValue(mockRequest),
      approve: jest.fn().mockResolvedValue({ ...mockRequest, status: RequestStatus.APPROVED }),
      reject: jest.fn().mockResolvedValue({ ...mockRequest, status: RequestStatus.REJECTED }),
      cancel: jest.fn().mockResolvedValue({ ...mockRequest, status: RequestStatus.CANCELLED }),
    };
    controller = new RequestsController(service as RequestsService);
  });

  describe('create', () => {
    it('should delegate to service.create', async () => {
      const dto = {
        employeeId: 'emp-1',
        locationId: 'loc-1',
        startDate: '2025-07-01',
        endDate: '2025-07-03',
        numberOfDays: 3,
      };
      const result = await controller.create(dto);

      expect(result).toEqual(mockRequest);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should delegate to service.findAll with query', async () => {
      const query = { employeeId: 'emp-1' };
      const result = await controller.findAll(query);

      expect(result).toEqual([mockRequest]);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should delegate to service.findOne', async () => {
      const result = await controller.findOne('uuid-1');

      expect(result).toEqual(mockRequest);
      expect(service.findOne).toHaveBeenCalledWith('uuid-1');
    });
  });

  describe('approve', () => {
    it('should delegate to service.approve', async () => {
      const result = await controller.approve('uuid-1', { reviewedBy: 'mgr-1' });

      expect(result.status).toBe(RequestStatus.APPROVED);
      expect(service.approve).toHaveBeenCalledWith('uuid-1', 'mgr-1');
    });
  });

  describe('reject', () => {
    it('should delegate to service.reject', async () => {
      const result = await controller.reject('uuid-1', { reviewedBy: 'mgr-1' });

      expect(result.status).toBe(RequestStatus.REJECTED);
      expect(service.reject).toHaveBeenCalledWith('uuid-1', 'mgr-1');
    });
  });

  describe('cancel', () => {
    it('should delegate to service.cancel', async () => {
      const result = await controller.cancel('uuid-1');

      expect(result.status).toBe(RequestStatus.CANCELLED);
      expect(service.cancel).toHaveBeenCalledWith('uuid-1');
    });
  });
});
