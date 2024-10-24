import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_applications')
export class UserApplication {
  @Column('uuid')
  user_id: string;

  @Column({ type: 'varchar', length: 255 })
  benefit_id: string;

  @PrimaryGeneratedColumn('uuid')
  internal_application_id: string;

  @Column({ type: 'varchar', length: 255 })
  benefit_provider_id: string;

  @Column({ type: 'varchar', length: 255 })
  benefit_provider_uri: string;

  @Column({ type: 'varchar', length: 100 })
  external_application_id: string;

  @Column({ type: 'text', nullable: true })
  application_name: string;

  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ type: 'jsonb' })
  application_data: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: true })
  updated_at: Date;
}
