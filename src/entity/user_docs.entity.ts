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
const encryptionTransformer = EncryptionTransformer(configService);

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

  @Column({ type: 'text', nullable: true, transformer: encryptionTransformer })
  doc_data: any; // Can be object, array, or null after decryption

  @Column({ type: 'varchar', length: 100 })
  doc_datatype: string;

  @Column({ type: 'boolean' })
  doc_verified: boolean;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  uploaded_at: Date;
}
