import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Balance } from './balance.entity';

@Injectable()
export class BalancesService {
  private readonly logger = new Logger(BalancesService.name);

  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    private readonly dataSource: DataSource,
  ) {}

  async findByEmployee(employeeId: string): Promise<Balance[]> {
    return this.balanceRepository.find({ where: { employeeId } });
  }

  async findByEmployeeAndLocation(
    employeeId: string,
    locationId: string,
  ): Promise<Balance | null> {
    return this.balanceRepository.findOne({ where: { employeeId, locationId } });
  }

  async findByEmployeeAndLocationOrFail(
    employeeId: string,
    locationId: string,
  ): Promise<Balance> {
    const balance = await this.findByEmployeeAndLocation(employeeId, locationId);
    if (!balance) {
      throw new NotFoundException(
        `No balance found for employee ${employeeId} at location ${locationId}`,
      );
    }
    return balance;
  }

  async upsertFromHcm(
    employeeId: string,
    locationId: string,
    totalDays: number,
    hcmVersion?: string,
  ): Promise<Balance> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Balance);
      let balance = await repo.findOne({ where: { employeeId, locationId } });

      if (balance) {
        balance.totalDays = totalDays;
        balance.hcmLastSyncedAt = new Date();
        if (hcmVersion) {
          balance.hcmVersion = hcmVersion;
        }
      } else {
        balance = repo.create({
          employeeId,
          locationId,
          totalDays,
          usedDays: 0,
          pendingDays: 0,
          hcmLastSyncedAt: new Date(),
          hcmVersion: hcmVersion || undefined,
        });
      }

      return repo.save(balance);
    });
  }

  async reservePendingDays(
    employeeId: string,
    locationId: string,
    days: number,
  ): Promise<Balance> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Balance);
      const balance = await repo.findOne({ where: { employeeId, locationId } });

      if (!balance) {
        throw new NotFoundException(
          `No balance found for employee ${employeeId} at location ${locationId}`,
        );
      }

      balance.pendingDays = Number(balance.pendingDays) + days;
      return repo.save(balance);
    });
  }

  async releasePendingDays(
    employeeId: string,
    locationId: string,
    days: number,
  ): Promise<Balance> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Balance);
      const balance = await repo.findOne({ where: { employeeId, locationId } });

      if (!balance) {
        throw new NotFoundException(
          `No balance found for employee ${employeeId} at location ${locationId}`,
        );
      }

      balance.pendingDays = Math.max(0, Number(balance.pendingDays) - days);
      return repo.save(balance);
    });
  }

  async confirmDays(
    employeeId: string,
    locationId: string,
    days: number,
  ): Promise<Balance> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Balance);
      const balance = await repo.findOne({ where: { employeeId, locationId } });

      if (!balance) {
        throw new NotFoundException(
          `No balance found for employee ${employeeId} at location ${locationId}`,
        );
      }

      balance.pendingDays = Math.max(0, Number(balance.pendingDays) - days);
      balance.usedDays = Number(balance.usedDays) + days;
      return repo.save(balance);
    });
  }

  async reverseDays(
    employeeId: string,
    locationId: string,
    days: number,
  ): Promise<Balance> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Balance);
      const balance = await repo.findOne({ where: { employeeId, locationId } });

      if (!balance) {
        throw new NotFoundException(
          `No balance found for employee ${employeeId} at location ${locationId}`,
        );
      }

      balance.usedDays = Math.max(0, Number(balance.usedDays) - days);
      return repo.save(balance);
    });
  }

  async batchUpsert(
    records: Array<{
      employeeId: string;
      locationId: string;
      totalDays: number;
      hcmVersion?: string;
    }>,
  ): Promise<{ updated: number; created: number }> {
    let updated = 0;
    let created = 0;

    for (const record of records) {
      const existing = await this.findByEmployeeAndLocation(
        record.employeeId,
        record.locationId,
      );
      await this.upsertFromHcm(
        record.employeeId,
        record.locationId,
        record.totalDays,
        record.hcmVersion,
      );
      if (existing) {
        updated++;
      } else {
        created++;
      }
    }

    this.logger.log(
      `Batch upsert complete: ${created} created, ${updated} updated`,
    );
    return { updated, created };
  }
}
