import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RequestStatus } from './request-status.enum';

@Entity('time_off_requests')
export class TimeOffRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @Column()
  locationId: string;

  @Column()
  startDate: string;

  @Column()
  endDate: string;

  @Column('decimal', { precision: 10, scale: 2 })
  numberOfDays: number;

  @Column({
    type: 'varchar',
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @Column({ nullable: true, type: 'text' })
  reason: string;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({ nullable: true })
  reviewedAt: Date;

  @Column({ nullable: true })
  hcmReferenceId: string;

  @Column({ nullable: true })
  hcmSubmittedAt: Date;

  @Column({ nullable: true })
  hcmResponseAt: Date;

  @Column({ nullable: true, type: 'text' })
  hcmErrorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
