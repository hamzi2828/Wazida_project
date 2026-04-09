import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { BalancesService } from './balances.service';
import { Balance } from './balance.entity';

@ApiTags('Balances')
@Controller('balances')
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get(':employeeId')
  @ApiOperation({ summary: 'Get all balances for an employee' })
  @ApiParam({ name: 'employeeId', description: 'Employee identifier' })
  async getByEmployee(
    @Param('employeeId') employeeId: string,
  ): Promise<Balance[]> {
    return this.balancesService.findByEmployee(employeeId);
  }

  @Get(':employeeId/:locationId')
  @ApiOperation({
    summary: 'Get balance for an employee at a specific location',
  })
  @ApiParam({ name: 'employeeId', description: 'Employee identifier' })
  @ApiParam({ name: 'locationId', description: 'Location identifier' })
  async getByEmployeeAndLocation(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ): Promise<Balance> {
    return this.balancesService.findByEmployeeAndLocationOrFail(
      employeeId,
      locationId,
    );
  }
}
