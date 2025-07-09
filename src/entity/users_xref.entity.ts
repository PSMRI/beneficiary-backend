import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
} from 'typeorm';

@Entity('users_xref')
@Index('idx_users_xref_user_id', ['user_id'])
export class UsersXref {
  @PrimaryColumn({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'boolean', default: false })
  fieldsVerified: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  fieldsVerifiedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  fieldsVerificationData: any;
} 