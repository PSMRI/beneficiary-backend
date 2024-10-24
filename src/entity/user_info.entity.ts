import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_info')
export class UserInfo {
  @PrimaryGeneratedColumn('uuid')
  user_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  father_name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  samagra_id: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  current_school_name: string;

  @Column({ type: 'text', nullable: true })
  current_school_address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  current_school_district: string;

  @Column({ type: 'int', nullable: true })
  current_class: number;

  @Column({ type: 'varchar', nullable: true })
  previous_year_marks: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  student_type: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  aadhaar: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  caste: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  income: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender: string;

  @Column({ type: 'int', nullable: true })
  age: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  disability: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  status: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
