// This codebase uses raw SQL queries instead of TypeORM entities.
// The user_id_verifications table is accessed via DataSource.query() in the service.
// See migration 0020_id_verification.sql for the table definition.

/*
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('user_id_verifications')
export class UserIdVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  userId: string;

  @Column()
  selfieUrl: string;

  @Column()
  idFrontUrl: string;

  @Column({ nullable: true })
  idBackUrl?: string;

  @Column({ type: 'enum', enum: ['none','pending','verified','rejected'], default: 'pending' })
  status: string;

  // ... reviewedAt, reviewerId, rejectionReason
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
*/
