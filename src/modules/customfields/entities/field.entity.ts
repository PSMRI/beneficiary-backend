import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	Index,
	OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { FieldValue } from './field-value.entity';

export enum FieldType {
	TEXT = 'text',
	TEXTAREA = 'textarea',
	NUMERIC = 'numeric',
	DATE = 'date',
	DATETIME = 'datetime',
	DROP_DOWN = 'drop_down',
	MULTI_SELECT = 'multi_select',
	CHECKBOX = 'checkbox',
	RADIO = 'radio',
	EMAIL = 'email',
	PHONE = 'phone',
	URL = 'url',
	FILE = 'file',
	JSON = 'json',
	CURRENCY = 'currency',
	PERCENT = 'percent',
	RATING = 'rating',
}

export enum FieldContext {
	USERS = 'USERS',
	COHORTS = 'COHORTS',
	APPLICATIONS = 'APPLICATIONS',
}

/**
 * Field entity representing custom field definitions
 * @entity fields
 * @description Stores the definition/metadata of each custom field that can be
 * associated with various entities like User, Cohort, etc.
 */
@Entity('fields')
@Index(['context', 'contextType'])
@Index(['context', 'ordering'])
@Index(['name', 'context'], { unique: true })
export class Field {
	/**
	 * Unique identifier for the field
	 * @description UUID v4 generated automatically on creation
	 */
	@ApiProperty({
		description: 'Unique identifier for the field',
		example: '550e8400-e29b-41d4-a716-446655440000',
		format: 'uuid',
	})
	@PrimaryGeneratedColumn('uuid')
	fieldId: string;

	/**
	 * Internal name of the field
	 * @description Machine-readable name for the field
	 */
	@ApiProperty({
		description: 'Internal name of the field',
		example: 'schoolName',
	})
	@Column({ length: 255 })
	@Index()
	name: string;

	/**
	 * Display label for the field
	 * @description Human-readable label shown in UI
	 */
	@ApiProperty({
		description: 'Display label for the field',
		example: 'School Name',
	})
	@Column({ length: 255 })
	label: string;

	/**
	 * Field data type
	 * @description Determines how the field value should be stored and validated
	 */
	@ApiProperty({
		description: 'Field data type',
		enum: FieldType,
		example: FieldType.TEXT,
	})
	@Column({
		type: 'enum',
		enum: FieldType,
	})
	type: FieldType;

	/**
	 * Entity context this field belongs to
	 * @description Defines which entity type this field can be associated with
	 */
	@ApiProperty({
		description: 'Entity context this field belongs to',
		enum: FieldContext,
		example: FieldContext.USERS,
	})
	@Column({
		type: 'enum',
		enum: FieldContext,
	})
	@Index()
	context: FieldContext;

	/**
	 * Context subtype or role
	 * @description Optional subtype for more specific categorization
	 */
	@ApiProperty({
		description: 'Context subtype or role',
		example: 'User',
		required: false,
	})
	@Column({ length: 100, nullable: true })
	contextType?: string;

	/**
	 * Display order for the field
	 * @description Used for ordering fields in UI
	 */
	@ApiProperty({
		description: 'Display order for the field',
		example: 7,
	})
	@Column({ type: 'int', default: 0 })
	@Index()
	ordering: number;

	/**
	 * Whether the field is required
	 * @description Determines if the field must have a value
	 */
	@ApiProperty({
		description: 'Whether the field is required',
		example: false,
	})
	@Column({ type: 'boolean', default: false })
	isRequired: boolean;

	/**
	 * Whether the field is hidden from UI
	 * @description Controls field visibility in forms
	 */
	@ApiProperty({
		description: 'Whether the field is hidden from UI',
		example: false,
	})
	@Column({ type: 'boolean', default: false })
	isHidden: boolean;

	/**
	 * Additional field parameters
	 * @description JSON object containing field-specific configuration
	 */
	@ApiProperty({
		description: 'Additional field parameters',
		example: {
			options: [
				{ name: 'Option 1', value: 'option1' },
				{ name: 'Option 2', value: 'option2' },
			],
			validation: {
				regex: '^[a-zA-Z0-9]+$',
				minLength: 3,
				maxLength: 50,
			},
		},
		required: false,
	})
	@Column({ type: 'jsonb', nullable: true })
	fieldParams?: Record<string, any>;

	/**
	 * Field attributes and metadata
	 * @description Additional attributes like isEditable, isEncrypted, etc.
	 */
	@ApiProperty({
		description: 'Field attributes and metadata',
		example: {
			isEditable: true,
			isRequired: false,
			isEncrypted: false,
			isSearchable: true,
		},
		required: false,
	})
	@Column({ type: 'jsonb', nullable: true })
	fieldAttributes?: Record<string, any>;

	/**
	 * Source details for dynamic fields
	 * @description Information about data source for dynamically populated fields
	 */
	@ApiProperty({
		description: 'Source details for dynamic fields',
		required: false,
	})
	@Column({ type: 'jsonb', nullable: true })
	sourceDetails?: Record<string, any>;

	/**
	 * Field dependencies
	 * @description Information about field dependencies and conditional logic
	 */
	@ApiProperty({
		description: 'Field dependencies',
		required: false,
	})
	@Column({ type: 'jsonb', nullable: true })
	dependsOn?: Record<string, any>;

	/**
	 * Field creation timestamp
	 * @description Automatically set when the field is created
	 */
	@ApiProperty({
		description: 'Field creation timestamp',
		example: '2023-01-01T00:00:00.000Z',
		format: 'date-time',
	})
	@CreateDateColumn()
	createdAt: Date;

	/**
	 * Field last update timestamp
	 * @description Automatically updated when the field is modified
	 */
	@ApiProperty({
		description: 'Field last update timestamp',
		example: '2023-01-01T00:00:00.000Z',
		format: 'date-time',
	})
	@UpdateDateColumn()
	updatedAt: Date;

	/**
	 * Field values associated with this field
	 * @description One-to-many relationship with FieldValue entity
	 */
	@OneToMany(() => FieldValue, (fieldValue) => fieldValue.field, {
		cascade: true,
		lazy: true,
	})
	fieldValues: Promise<FieldValue[]>;

	/**
	 * Check if field has specific attribute
	 * @param attributeName Name of the attribute to check
	 * @returns true if field has the attribute with truthy value
	 */
	hasAttribute(attributeName: string): boolean {
		return this.fieldAttributes?.[attributeName] === true;
	}

	/**
	 * Get field parameter value
	 * @param paramName Name of the parameter to get
	 * @returns Parameter value or undefined
	 */
	getParam(paramName: string): any {
		return this.fieldParams?.[paramName];
	}

	/**
	 * Check if field is editable
	 * @returns true if field is editable
	 */
	isEditable(): boolean {
		return this.hasAttribute('isEditable') !== false;
	}

	/**
	 * Check if field is encrypted
	 * @returns true if field is encrypted
	 */
	isEncrypted(): boolean {
		return this.hasAttribute('isEncrypted');
	}

	/**
	 * Check if field is searchable
	 * @returns true if field is searchable
	 */
	isSearchable(): boolean {
		return this.hasAttribute('isSearchable') !== false;
	}
}
