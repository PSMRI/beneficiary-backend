import { ApiProperty } from '@nestjs/swagger';
import {
	IsString,
	IsEnum,
	IsOptional,
	IsNumber,
	IsBoolean,
	IsObject,
	Length,
	Min,
	Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FieldType, FieldContext } from '../entities/field.entity';

/**
 * DTO for creating a new custom field
 */
export class CreateFieldDto {
	/**
	 * Internal name of the field
	 * @description Machine-readable name for the field
	 */
	@ApiProperty({
		description: 'Internal name of the field',
		example: 'schoolName',
		minLength: 1,
		maxLength: 255,
	})
	@IsString()
	@Length(1, 255)
	name: string;

	/**
	 * Display label for the field
	 * @description Human-readable label shown in UI
	 */
	@ApiProperty({
		description: 'Display label for the field',
		example: 'School Name',
		minLength: 1,
		maxLength: 255,
	})
	@IsString()
	@Length(1, 255)
	label: string;

	/**
	 * Entity context this field belongs to
	 * @description Defines which entity type this field can be associated with
	 */
	@ApiProperty({
		description: 'Entity context this field belongs to',
		enum: FieldContext,
		example: FieldContext.USERS,
	})
	@IsEnum(FieldContext)
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
	@IsOptional()
	@IsString()
	@Length(1, 100)
	contextType?: string;

	/**
	 * Field data type
	 * @description Determines how the field value should be stored and validated
	 */
	@ApiProperty({
		description: 'Field data type',
		enum: FieldType,
		example: FieldType.TEXT,
	})
	@IsEnum(FieldType)
	type: FieldType;

	/**
	 * Display order for the field
	 * @description Used for ordering fields in UI
	 */
	@ApiProperty({
		description: 'Display order for the field',
		example: 7,
		minimum: 0,
		maximum: 9999,
	})
	@IsNumber()
	@Type(() => Number)
	@Min(0)
	@Max(9999)
	ordering: number;

	/**
	 * Whether the field is required
	 * @description Determines if the field must have a value
	 */
	@ApiProperty({
		description: 'Whether the field is required',
		example: false,
		required: false,
	})
	@IsOptional()
	@IsBoolean()
	@Type(() => Boolean)
	isRequired?: boolean;

	/**
	 * Whether the field is hidden from UI
	 * @description Controls field visibility in forms
	 */
	@ApiProperty({
		description: 'Whether the field is hidden from UI',
		example: false,
		required: false,
	})
	@IsOptional()
	@IsBoolean()
	@Type(() => Boolean)
	isHidden?: boolean;

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
	@IsOptional()
	@IsObject()
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
	@IsOptional()
	@IsObject()
	fieldAttributes?: Record<string, any>;

	/**
	 * Source details for dynamic fields
	 * @description Information about data source for dynamically populated fields
	 */
	@ApiProperty({
		description: 'Source details for dynamic fields',
		required: false,
	})
	@IsOptional()
	@IsObject()
	sourceDetails?: Record<string, any>;

	/**
	 * Field dependencies
	 * @description Information about field dependencies and conditional logic
	 */
	@ApiProperty({
		description: 'Field dependencies',
		required: false,
	})
	@IsOptional()
	@IsObject()
	dependsOn?: Record<string, any>;
}
