import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { EncryptionTransformer } from 'src/common/helper/encryptionTransformer';
import { ConfigService } from '@nestjs/config';

const configService = new ConfigService();
const encryptionTransformer = new EncryptionTransformer(configService);

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

  @Column({ type: 'varchar', length: 1500, nullable: true })
  doc_data_link: string;

	@Column({
		type: 'text',
		nullable: true,
		transformer: encryptionTransformer,
	})
  doc_data: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 100 })
  doc_datatype: string;

  @Column({ type: 'boolean' })
  doc_verified: boolean;

  @Column({ type: 'boolean', default: false, nullable: false })
  watcher_registered: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  watcher_email: string;

  @Column({ type: 'varchar', length: 1500, nullable: true })
  watcher_callback_url: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  uploaded_at: Date;
}
