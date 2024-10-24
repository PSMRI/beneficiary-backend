import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_docs')
export class UserDoc {
  @PrimaryGeneratedColumn('uuid')
  doc_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, (user) => user.user_id)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 50 })
  doc_type: string;

  @Column({ type: 'varchar', length: 255 })
  doc_subtype: string;

  @Column({ type: 'varchar', length: 255 })
  doc_name: string;

  @Column({ type: 'varchar', length: 255 })
  imported_from: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  doc_path: string;

  @Column({ type: 'text', nullable: true })
  doc_data: string;

  @Column({ type: 'varchar', length: 100 })
  doc_datatype: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  uploaded_at: Date;
}
