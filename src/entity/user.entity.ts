import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('users')
@Unique(['user_id', 'email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  user_id: string;

  @Column({ length: 50 })
  first_name: string;

  @Column({ length: 50, nullable: true })
  middle_name: string;

  @Column({ length: 50 })
  last_name: string;

  @Column({ length: 100, unique: true })
  email: string;

  @Column({ length: 100, nullable: true })
  phone_number: string;

  @Column({ type: 'date', nullable: true })
  date_of_birth: Date;

  @Column({ length: 255 })
  sso_provider: string;

  @Column({ length: 255 })
  sso_id: string;

  @Column({ length: 255, nullable: true })
  image: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: true })
  updated_at: Date;
}
