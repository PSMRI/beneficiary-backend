import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	Unique,
} from 'typeorm';

@Entity('settings')
@Unique(['key'])
export class Setting {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ type: 'varchar', length: 255 })
	key: string;

	@Column({ type: 'jsonb', nullable: false })
	value: any;

	@CreateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
	created: Date;

	@UpdateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
	lastUpdated: Date;

	@Column({ type: 'varchar', length: 255 })
	createdBy: string;

	@Column({ type: 'varchar', length: 255 })
	updatedBy: string;
}
