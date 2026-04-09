import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { ReviewRequestDto } from './dto/review-request.dto';
import { QueryRequestsDto } from './dto/query-requests.dto';
import { TimeOffRequest } from './time-off-request.entity';

@ApiTags('Time-Off Requests')
@Controller('time-off-requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new time-off request' })
  async create(@Body() dto: CreateRequestDto): Promise<TimeOffRequest> {
    return this.requestsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List time-off requests with optional filters' })
  async findAll(@Query() query: QueryRequestsDto): Promise<TimeOffRequest[]> {
    return this.requestsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific time-off request by ID' })
  @ApiParam({ name: 'id', description: 'Request UUID' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TimeOffRequest> {
    return this.requestsService.findOne(id);
  }

  @Patch(':id/approve')
  @ApiOperation({
    summary: 'Approve a pending time-off request (manager action)',
  })
  @ApiParam({ name: 'id', description: 'Request UUID' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewRequestDto,
  ): Promise<TimeOffRequest> {
    return this.requestsService.approve(id, dto.reviewedBy);
  }

  @Patch(':id/reject')
  @ApiOperation({
    summary: 'Reject a pending time-off request (manager action)',
  })
  @ApiParam({ name: 'id', description: 'Request UUID' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewRequestDto,
  ): Promise<TimeOffRequest> {
    return this.requestsService.reject(id, dto.reviewedBy);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a time-off request (employee action)' })
  @ApiParam({ name: 'id', description: 'Request UUID' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TimeOffRequest> {
    return this.requestsService.cancel(id);
  }
}
