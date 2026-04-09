import { BalancesController } from './balances.controller';
import { BalancesService } from './balances.service';
import { NotFoundException } from '@nestjs/common';

describe('BalancesController', () => {
  let controller: BalancesController;
  let service: Partial<BalancesService>;

  beforeEach(() => {
    service = {
      findByEmployee: jest.fn(),
      findByEmployeeAndLocationOrFail: jest.fn(),
    };
    controller = new BalancesController(service as BalancesService);
  });

  describe('getByEmployee', () => {
    it('should return all balances for an employee', async () => {
      const balances = [
        { id: 1, employeeId: 'emp-1', locationId: 'loc-1', totalDays: 20 },
      ];
      (service.findByEmployee as jest.Mock).mockResolvedValue(balances);

      const result = await controller.getByEmployee('emp-1');

      expect(result).toEqual(balances);
      expect(service.findByEmployee).toHaveBeenCalledWith('emp-1');
    });

    it('should return empty array for unknown employee', async () => {
      (service.findByEmployee as jest.Mock).mockResolvedValue([]);

      const result = await controller.getByEmployee('emp-unknown');

      expect(result).toEqual([]);
    });
  });

  describe('getByEmployeeAndLocation', () => {
    it('should return balance for a specific employee-location', async () => {
      const balance = { id: 1, employeeId: 'emp-1', locationId: 'loc-1', totalDays: 20 };
      (service.findByEmployeeAndLocationOrFail as jest.Mock).mockResolvedValue(balance);

      const result = await controller.getByEmployeeAndLocation('emp-1', 'loc-1');

      expect(result).toEqual(balance);
      expect(service.findByEmployeeAndLocationOrFail).toHaveBeenCalledWith('emp-1', 'loc-1');
    });

    it('should propagate NotFoundException', async () => {
      (service.findByEmployeeAndLocationOrFail as jest.Mock).mockRejectedValue(
        new NotFoundException('Not found'),
      );

      await expect(
        controller.getByEmployeeAndLocation('emp-1', 'loc-unknown'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
