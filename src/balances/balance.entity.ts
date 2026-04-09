import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('balances')
@Unique(['employeeId', 'locationId'])
export class Balance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  employeeId: string;

  @Column()
  locationId: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalDays: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  usedDays: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  pendingDays: number;

  @Column({ nullable: true })
  hcmLastSyncedAt: Date;

  @Column({ nullable: true })
  hcmVersion: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  get availableDays(): number {
    return Number(this.totalDays) - Number(this.usedDays) - Number(this.pendingDays);
  }
}
