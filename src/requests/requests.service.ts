import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsWhere } from 'typeorm';
import { TimeOffRequest } from './time-off-request.entity';
import { RequestStatus } from './request-status.enum';
import { CreateRequestDto } from './dto/create-request.dto';
import { QueryRequestsDto } from './dto/query-requests.dto';
import { BalancesService } from '../balances/balances.service';
import { HcmService } from '../hcm/hcm.service';
import { Balance } from '../balances/balance.entity';

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    @InjectRepository(TimeOffRequest)
    private readonly requestRepository: Repository<TimeOffRequest>,
    private readonly balancesService: BalancesService,
    private readonly hcmService: HcmService,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateRequestDto): Promise<TimeOffRequest> {
    if (dto.startDate > dto.endDate) {
      throw new BadRequestException(
        'Start date must be before or equal to end date',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const balanceRepo = manager.getRepository(Balance);

      // 1. Try to sync balance from HCM for freshness
      let balance: Balance | null = null;
      try {
        const hcmBalance = await this.hcmService.getBalance(
          dto.employeeId,
          dto.locationId,
        );
        balance = await balanceRepo.findOne({
          where: { employeeId: dto.employeeId, locationId: dto.locationId },
        });
        if (balance) {
          balance.totalDays = hcmBalance.totalDays;
          balance.hcmLastSyncedAt = new Date();
          if (hcmBalance.version) {
            balance.hcmVersion = hcmBalance.version;
          }
          await balanceRepo.save(balance);
        } else {
          balance = balanceRepo.create({
            employeeId: dto.employeeId,
            locationId: dto.locationId,
            totalDays: hcmBalance.totalDays,
            usedDays: 0,
            pendingDays: 0,
            hcmLastSyncedAt: new Date(),
            hcmVersion: hcmBalance.version || undefined,
          });
          await balanceRepo.save(balance);
        }
      } catch (error: any) {
        this.logger.warn(
          `HCM sync failed, using local balance: ${error.message}`,
        );
        balance = await balanceRepo.findOne({
          where: { employeeId: dto.employeeId, locationId: dto.locationId },
        });
      }

      if (!balance) {
        throw new NotFoundException(
          `No balance found for employee ${dto.employeeId} at location ${dto.locationId}. ` +
            `Ensure the employee/location combination exists in the HCM system.`,
        );
      }

      // 2. Defensive local balance check
      const available =
        Number(balance.totalDays) -
        Number(balance.usedDays) -
        Number(balance.pendingDays);
      if (available < dto.numberOfDays) {
        throw new ConflictException(
          `Insufficient balance. Available: ${available} days, Requested: ${dto.numberOfDays} days`,
        );
      }

      // 3. Create the request
      const requestRepo = manager.getRepository(TimeOffRequest);
      const request = requestRepo.create({
        ...dto,
        status: RequestStatus.PENDING,
      });
      const saved = await requestRepo.save(request);

      // 4. Reserve pending days
      balance.pendingDays = Number(balance.pendingDays) + dto.numberOfDays;
      await balanceRepo.save(balance);

      return saved;
    });
  }

  async findAll(query: QueryRequestsDto): Promise<TimeOffRequest[]> {
    const where: FindOptionsWhere<TimeOffRequest> = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.status) where.status = query.status;

    return this.requestRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<TimeOffRequest> {
    const request = await this.requestRepository.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException(`Time-off request ${id} not found`);
    }
    return request;
  }

  async approve(id: string, reviewedBy: string): Promise<TimeOffRequest> {
    const request = await this.findOne(id);

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot approve request in ${request.status} status. Only PENDING requests can be approved.`,
      );
    }

    try {
      const hcmResponse = await this.hcmService.submitTimeOff({
        employeeId: request.employeeId,
        locationId: request.locationId,
        startDate: request.startDate,
        endDate: request.endDate,
        numberOfDays: request.numberOfDays,
      });

      request.status = RequestStatus.APPROVED;
      request.reviewedBy = reviewedBy;
      request.reviewedAt = new Date();
      request.hcmReferenceId = hcmResponse.referenceId;
      request.hcmSubmittedAt = new Date();
      request.hcmResponseAt = new Date();

      await this.balancesService.confirmDays(
        request.employeeId,
        request.locationId,
        request.numberOfDays,
      );

      this.logger.log(
        `Request ${id} approved and confirmed with HCM (ref: ${hcmResponse.referenceId})`,
      );
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || error.message;

      request.status = RequestStatus.HCM_REJECTED;
      request.reviewedBy = reviewedBy;
      request.reviewedAt = new Date();
      request.hcmResponseAt = new Date();
      request.hcmErrorMessage = errorMessage;

      await this.balancesService.releasePendingDays(
        request.employeeId,
        request.locationId,
        request.numberOfDays,
      );

      this.logger.warn(`Request ${id} rejected by HCM: ${errorMessage}`);
    }

    return this.requestRepository.save(request);
  }

  async reject(id: string, reviewedBy: string): Promise<TimeOffRequest> {
    const request = await this.findOne(id);

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject request in ${request.status} status. Only PENDING requests can be rejected.`,
      );
    }

    request.status = RequestStatus.REJECTED;
    request.reviewedBy = reviewedBy;
    request.reviewedAt = new Date();

    await this.balancesService.releasePendingDays(
      request.employeeId,
      request.locationId,
      request.numberOfDays,
    );

    this.logger.log(`Request ${id} rejected by ${reviewedBy}`);
    return this.requestRepository.save(request);
  }

  async cancel(id: string): Promise<TimeOffRequest> {
    const request = await this.findOne(id);

    if (request.status === RequestStatus.PENDING) {
      await this.balancesService.releasePendingDays(
        request.employeeId,
        request.locationId,
        request.numberOfDays,
      );
    } else if (request.status === RequestStatus.APPROVED) {
      if (request.hcmReferenceId) {
        try {
          await this.hcmService.cancelTimeOff(request.hcmReferenceId);
        } catch (error: any) {
          this.logger.error(
            `Failed to cancel request ${id} in HCM: ${error.message}`,
          );
          throw new ConflictException(
            'Failed to cancel the request in the HCM system. Please try again or contact support.',
          );
        }
      }
      await this.balancesService.reverseDays(
        request.employeeId,
        request.locationId,
        request.numberOfDays,
      );
    } else {
      throw new BadRequestException(
        `Cannot cancel request in ${request.status} status. Only PENDING or APPROVED requests can be cancelled.`,
      );
    }

    request.status = RequestStatus.CANCELLED;
    this.logger.log(`Request ${id} cancelled`);
    return this.requestRepository.save(request);
  }
}
