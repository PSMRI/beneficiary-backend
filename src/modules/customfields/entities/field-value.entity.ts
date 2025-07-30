import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	Index,
	ManyToOne,
	JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Field } from './field.entity';

/**
 * FieldValue entity representing custom field values
 * @entity fieldValues
 * @description Stores the value of each custom field for a specific entity instance.
 * The itemId is a generic reference that can point to a User, Cohort, etc.
 */
@Entity('fieldValues')
@Index(['fieldId', 'itemId'])
@Index(['itemId'])
@Index(['fieldId'])
export class FieldValue {
	/**
	 * Unique identifier for the field value
	 * @description UUID v4 generated automatically on creation
	 */
	@ApiProperty({
		description: 'Unique identifier for the field value',
		example: '550e8400-e29b-41d4-a716-446655440000',
		format: 'uuid',
	})
	@PrimaryGeneratedColumn('uuid')
		id: string;

	/**
	 * Reference to the field definition
	 * @description Foreign key to the Field entity
	 */
	@ApiProperty({
		description: 'Reference to the field definition',
		example: '550e8400-e29b-41d4-a716-446655440000',
		format: 'uuid',
	})
	@Column({ type: 'uuid' })
	@Index()
		fieldId: string;

	/**
	 * Generic entity instance ID
	 * @description UUID of the entity instance (e.g., userId, cohortId, etc.)
	 * This allows the same field to be used across different entity types
	 */
	@ApiProperty({
		description: 'Generic entity instance ID',
		example: '550e8400-e29b-41d4-a716-446655440000',
		format: 'uuid',
	})
	@Column({ type: 'uuid' })
	@Index()
		itemId: string;

	/**
	 * The field value
	 * @description The actual value stored for this field instance
	 * Type depends on the field type - stored as text but can be JSON for complex types
	 * For encrypted fields, this contains the encrypted value
	 */
	@ApiProperty({
		description: 'The field value',
		example: 'Some text value',
	})
	@Column({ type: 'text', nullable: true })
		value: string;

	/**
	 * Additional metadata for the field value
	 * @description JSON object containing value-specific metadata
	 */
	@ApiProperty({
		description: 'Additional metadata for the field value',
		example: {
			originalFilename: 'document.pdf',
			fileSize: 1024,
			mimeType: 'application/pdf',
		},
		required: false,
	})
	@Column({ type: 'jsonb', nullable: true })
		metadata?: Record<string, any>;

	/**
	 * Field value creation timestamp
	 * @description Automatically set when the field value is created
	 */
	@ApiProperty({
		description: 'Field value creation timestamp',
		example: '2023-01-01T00:00:00.000Z',
		format: 'date-time',
	})
	@CreateDateColumn()
		createdAt: Date;

	/**
	 * Field value last update timestamp
	 * @description Automatically updated when the field value is modified
	 */
	@ApiProperty({
		description: 'Field value last update timestamp',
		example: '2023-01-01T00:00:00.000Z',
		format: 'date-time',
	})
	@UpdateDateColumn()
		updatedAt: Date;

	/**
	 * Field definition this value belongs to
	 * @description Many-to-one relationship with Field entity
	 */
	@ManyToOne(() => Field, (field) => field.fieldValues, {
		onDelete: 'CASCADE',
		eager: false,
	})
	@JoinColumn({ name: 'fieldId' })
		field: Field;

	/**
	 * Get parsed value based on field type
	 * @returns Parsed value according to field type
	 */
	getParsedValue(): any {
		if (!this.value) {
			return null;
		}

		if (!this.field) {
			return this.value;
		}

		// Use centralized deserialization from FieldValidationHelper
		// Note: This method is used by the entity itself, so we can't inject the helper
		// The service layer should use FieldValidationHelper.deserializeValue() instead
		switch (this.field.type) {
			case 'numeric':
			case 'currency':
			case 'percent':
			case 'rating':
				return parseFloat(this.value);

			case 'date':
			case 'datetime':
				return new Date(this.value);

			case 'checkbox':
				return this.value === 'true';

			case 'multi_select':
			case 'json':
				try {
					return JSON.parse(this.value);
				} catch {
					return this.value;
				}

			default:
				return this.value;
		}
	}



	/**
	 * Set encrypted value (used by service layer)
	 * @param encryptedValue The encrypted value to store
	 */
	setEncryptedValue(encryptedValue: string): void {
		this.value = encryptedValue;
	}

	/**
	 * Check if value is empty
	 * @returns true if value is empty or null
	 */
	isEmpty(): boolean {
		return !this.value || this.value.trim() === '';
	}

}
