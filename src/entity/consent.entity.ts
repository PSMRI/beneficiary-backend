import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
// import { User } from './user.entity';

@Entity('consent')
export class Consent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid' })
  user_id: string; // Assuming user_id is of UUID type

  @Column({ type: 'varchar', length: 255 })
  purpose: string;

  @Column({ type: 'text' })
  purpose_text: string;

  @Column({ type: 'boolean' })
  accepted: boolean;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  consent_date: Date;

  // Optional: Define relationship with User entity if needed
  // @ManyToOne(() => User, (user) => user.user_id)
  // @JoinColumn({ name: 'user_id' }) // Specifies the foreign key column
  // user: User; // Optional: This will allow you to access the user details directly from the consent
}
