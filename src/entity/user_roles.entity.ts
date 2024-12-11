import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '@entities/user.entity';
import { Role } from '@entities/role.entity';

@Entity('user_roles')
export class UserRole {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid' })
  role_id: string; // Use role_id as defined in your SQL

  @Column({ type: 'uuid' })
  user_id: string; // Use user_id as defined in your SQL

  @Column({ type: 'varchar', length: 100 })
  role_slug: string;

  @Column({ type: 'boolean' })
  status: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: true })
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.user_id)
  user: User;

  @ManyToOne(() => Role, (role) => role.role_id)
  role: Role;
}
