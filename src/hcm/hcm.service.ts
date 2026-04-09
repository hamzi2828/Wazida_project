import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

export interface HcmBalanceResponse {
  employeeId: string;
  locationId: string;
  totalDays: number;
  version?: string;
}

export interface HcmTimeOffSubmission {
  employeeId: string;
  locationId: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
}

export interface HcmTimeOffResponse {
  referenceId: string;
  status: string;
  message?: string;
}

@Injectable()
export class HcmService {
  private readonly logger = new Logger(HcmService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'HCM_BASE_URL',
      'http://localhost:3001',
    );
    this.apiKey = this.configService.get<string>('HCM_API_KEY', '');
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { 'x-api-key': this.apiKey } : {}),
    };
  }

  async getBalance(
    employeeId: string,
    locationId: string,
  ): Promise<HcmBalanceResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<HcmBalanceResponse>(
          `${this.baseUrl}/api/balances/${employeeId}/${locationId}`,
          { headers: this.getHeaders(), timeout: 5000 },
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to get balance from HCM for employee=${employeeId} location=${locationId}: ${this.extractErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async submitTimeOff(
    data: HcmTimeOffSubmission,
  ): Promise<HcmTimeOffResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<HcmTimeOffResponse>(
          `${this.baseUrl}/api/time-off`,
          data,
          { headers: this.getHeaders(), timeout: 10000 },
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to submit time-off to HCM: ${this.extractErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async cancelTimeOff(hcmReferenceId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.delete(
          `${this.baseUrl}/api/time-off/${hcmReferenceId}`,
          { headers: this.getHeaders(), timeout: 10000 },
        ),
      );
    } catch (error) {
      this.logger.error(
        `Failed to cancel time-off in HCM (ref: ${hcmReferenceId}): ${this.extractErrorMessage(error)}`,
      );
      throw error;
    }
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
      return error.response?.data?.message || error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
