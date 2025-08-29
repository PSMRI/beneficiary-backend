import {
	Controller,
	Get,
	Post,
	Put,
	Delete,
	Body,
	Param,
	Query,
	HttpCode,
	HttpStatus,
	ParseUUIDPipe,
	UsePipes,
	ValidationPipe,
	UseGuards,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiParam,
	ApiQuery,
	ApiBody,
	ApiBearerAuth,
} from '@nestjs/swagger';
import { CustomFieldsService } from './customfields.service';
import { CreateFieldDto } from './dto/create-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { QueryFieldsDto } from './dto/query-fields.dto';
import { Field, FieldContext } from './entities/field.entity';
import { CustomFieldDto } from './dto/custom-field.dto';
import { AuthGuard } from '@modules/auth/auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/common/enums/roles.enum';

/**
 * Controller for managing custom fields
 * @description Provides API endpoints for CRUD operations on fields
 * and field values, supporting dynamic field management
 */
@ApiTags('Custom Fields')
@Controller('fields')
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true }))
export class CustomFieldsController {
	constructor(private readonly customFieldsService: CustomFieldsService) {}

	/**
	 * Create a new custom field
	 * @param createFieldDto
	 * @description Creates a new field definition that can be used with entities
	 */
	@Post()
	@UseGuards(AuthGuard, RoleGuard)
	@Roles(UserRole.ADMIN)
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Create a new custom field',
		description:
			'Creates a new field definition with specified type and constraints',
	})
	@ApiBody({
		type: CreateFieldDto,
		examples: {
			textField: {
				summary: 'Text Field Example',
				value: {
					name: 'schoolName',
					label: 'School Name',
					context: 'USERS',
					contextType: 'User',
					type: 'text',
					ordering: 7,
					fieldParams: null,
					fieldAttributes: {
						isEditable: true,
						isRequired: false,
						isEncrypted: false,
					},
					sourceDetails: null,
					dependsOn: {},
				},
			},
			dropdownField: {
				summary: 'Dropdown Field Example',
				value: {
					name: 'bloodGroup',
					label: 'Blood Group',
					context: 'USERS',
					contextType: 'User',
					type: 'drop_down',
					ordering: 10,
					fieldParams: {
						options: [
							{ name: 'A+', value: 'a_positive' },
							{ name: 'B+', value: 'b_positive' },
							{ name: 'O+', value: 'o_positive' },
							{ name: 'AB+', value: 'ab_positive' },
						],
					},
					fieldAttributes: {
						isEditable: true,
						isRequired: false,
						isEncrypted: false,
					},
				},
			},
			encryptedField: {
				summary: 'Encrypted Field Example',
				value: {
					name: 'ssn',
					label: 'Social Security Number',
					context: 'USERS',
					contextType: 'User',
					type: 'text',
					ordering: 15,
					fieldParams: {
						validation: {
							regex: '^\\d{3}-\\d{2}-\\d{4}$',
							minLength: 11,
							maxLength: 11,
						},
					},
					fieldAttributes: {
						isEditable: true,
						isRequired: true,
						isEncrypted: true,
					},
				},
			},
		},
	})
	@ApiResponse({
		status: 201,
		description: 'Field created successfully',
		type: Field,
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid input data',
	})
	@ApiResponse({
		status: 409,
		description: 'Field with same name already exists in context',
	})
	async createField(@Body() createFieldDto: CreateFieldDto): Promise<Field> {
		return this.customFieldsService.createField(createFieldDto);
	}

	/**
	 * Get all field definitions
	 * @param queryDto
	 * @description Retrieves all field definitions with optional filtering
	 */
	@Get()
	@ApiOperation({
		summary: 'Get all field definitions',
		description:
			'Retrieves field definitions with optional filtering by context, type, etc.',
	})
	@ApiQuery({
		name: 'context',
		required: false,
		enum: FieldContext,
		description: 'Filter by entity context',
	})
	@ApiQuery({
		name: 'contextType',
		required: false,
		type: String,
		description: 'Filter by context type',
	})
	@ApiQuery({
		name: 'isRequired',
		required: false,
		type: Boolean,
		description: 'Filter by required status',
	})
	@ApiQuery({
		name: 'isHidden',
		required: false,
		type: Boolean,
		description: 'Filter by hidden status',
	})
	@ApiQuery({
		name: 'filterDataFields',
		required: false,
		type: String,
		description: 'Comma-separated list of fields to include in response (e.g., "name,label,type,context")',
	})
	@ApiResponse({
		status: 200,
		description: 'Fields retrieved successfully',
		type: [Field],
	})
	async findFields(@Query() queryDto: QueryFieldsDto): Promise<Field[]> {
		return this.customFieldsService.findFields(queryDto);
	}

	/**
	 * Get a specific field by ID
	 * @param fieldId
	 * @description Retrieves a single field definition by its ID
	 */
	@Get(':fieldId')
	@ApiOperation({
		summary: 'Get field by ID',
		description:
			'Retrieves a specific field definition by its unique identifier',
	})
	@ApiParam({
		name: 'fieldId',
		type: String,
		format: 'uuid',
		description: 'Unique field identifier',
	})
	@ApiResponse({
		status: 200,
		description: 'Field retrieved successfully',
		type: Field,
	})
	@ApiResponse({
		status: 404,
		description: 'Field not found',
	})
	async findFieldById(
		@Param('fieldId', ParseUUIDPipe) fieldId: string
	): Promise<Field> {
		return this.customFieldsService.findFieldById(fieldId);
	}

	/**
	 * Update a field definition
	 * @param fieldId
	 * @param updateFieldDto
	 * @description Updates an existing field definition
	 */
	@Put(':fieldId')
	@UseGuards(AuthGuard, RoleGuard)
	@Roles(UserRole.ADMIN)
	@ApiOperation({
		summary: 'Update field definition',
		description: 'Updates an existing field definition with new properties',
	})
	@ApiParam({
		name: 'fieldId',
		type: String,
		format: 'uuid',
		description: 'Unique field identifier',
	})
	@ApiBody({
		type: UpdateFieldDto,
		examples: {
			updateLabel: {
				summary: 'Update Field Label',
				value: {
					label: 'Updated School District',
					fieldAttributes: {
						isEditable: true,
						isRequired: true,
						isEncrypted: false,
					},
				},
			},
			updateOptions: {
				summary: 'Update Dropdown Options',
				value: {
					fieldParams: {
						options: [
							{ name: 'A+', value: 'a_positive' },
							{ name: 'A-', value: 'a_negative' },
							{ name: 'B+', value: 'b_positive' },
							{ name: 'B-', value: 'b_negative' },
							{ name: 'O+', value: 'o_positive' },
							{ name: 'O-', value: 'o_negative' },
							{ name: 'AB+', value: 'ab_positive' },
							{ name: 'AB-', value: 'ab_negative' },
						],
					},
				},
			},
			enableEncryption: {
				summary: 'Enable Field Encryption',
				value: {
					fieldAttributes: {
						isEditable: true,
						isRequired: false,
						isEncrypted: true,
					},
				},
			},
		},
	})
	@ApiResponse({
		status: 200,
		description: 'Field updated successfully',
		type: Field,
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid input data',
	})
	@ApiResponse({
		status: 404,
		description: 'Field not found',
	})
	@ApiResponse({
		status: 409,
		description: 'Field name conflict',
	})
	async updateField(
		@Param('fieldId', ParseUUIDPipe) fieldId: string,
		@Body() updateFieldDto: UpdateFieldDto
	): Promise<Field> {
		return this.customFieldsService.updateField(fieldId, updateFieldDto);
	}

	/**
	 * Delete a field definition
	 * @param fieldId
	 * @description Deletes a field definition and all its associated values
	 */
	@Delete(':fieldId')
	@UseGuards(AuthGuard, RoleGuard)
	@Roles(UserRole.ADMIN)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Delete field definition',
		description: 'Deletes a field definition and all its associated values. Checks if field is mapped to document fields or entities before deletion.',
	})
	@ApiParam({
		name: 'fieldId',
		type: String,
		format: 'uuid',
		description: 'Unique field identifier',
	})
	@ApiResponse({
		status: 200,
		description: 'Field deleted successfully',
		schema: {
			type: 'object',
			properties: {
				fieldDeleted: {
					type: 'number',
					description: 'Number of fields deleted',
				},
				valuesDeleted: {
					type: 'number',
					description: 'Number of field values deleted',
				},
			},
		},
	})
	@ApiResponse({
		status: 404,
		description: 'Field not found',
	})
	@ApiResponse({
		status: 403,
		description: 'Field is mapped to document fields or entities and cannot be deleted',
	})
	async deleteField(
		@Param('fieldId', ParseUUIDPipe) fieldId: string
	): Promise<{ fieldDeleted: number; valuesDeleted: number }> {
		return await this.customFieldsService.deleteField(fieldId);
	}

	/**
	 * Get custom fields for a specific entity
	 * @param context
	 * @param itemId
	 * @description Retrieves all custom fields and their values for a specific entity instance
	 */
	@Get('values/:context/:itemId')
	@ApiOperation({
		summary: 'Get custom fields for entity',
		description:
			'Retrieves all custom fields and their values for a specific entity instance',
	})
	@ApiParam({
		name: 'context',
		enum: FieldContext,
		description: 'Entity context (USERS, COHORTS, etc.)',
	})
	@ApiParam({
		name: 'itemId',
		type: String,
		description: 'Entity instance ID',
	})
	@ApiResponse({
		status: 200,
		description: 'Custom fields retrieved successfully',
		type: [CustomFieldDto],
	})
	async getCustomFields(
		@Param('context') context: FieldContext,
		@Param('itemId', ParseUUIDPipe) itemId: string
	): Promise<CustomFieldDto[]> {
		return this.customFieldsService.getCustomFields(itemId, context);
	}

	/**
	 * Delete custom fields for a specific entity
	 * @param context
	 * @param itemId
	 * @param fieldIds
	 * @description Deletes all or specific custom field values for an entity instance
	 */
	@Delete('values/:context/:itemId')
	@UseGuards(AuthGuard, RoleGuard)
	@Roles(UserRole.ADMIN)
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Delete custom fields for entity',
		description:
			'Deletes all or specific custom field values for an entity instance',
	})
	@ApiParam({
		name: 'context',
		enum: FieldContext,
		description: 'Entity context (USERS, COHORTS, etc.)',
	})
	@ApiParam({
		name: 'itemId',
		type: String,
		description: 'Entity instance ID',
	})
	@ApiQuery({
		name: 'fieldIds',
		required: false,
		type: [String],
		description: 'Specific field IDs to delete (comma-separated)',
	})
	@ApiResponse({
		status: 204,
		description: 'Custom fields deleted successfully',
	})
	async deleteCustomFields(
		@Param('context') context: FieldContext,
		@Param('itemId', ParseUUIDPipe) itemId: string,
		@Query('fieldIds') fieldIds?: string
	): Promise<void> {
		const fieldIdArray = fieldIds ? fieldIds.split(',') : undefined;
		await this.customFieldsService.deleteCustomFields(
			itemId,
			context,
			fieldIdArray
		);
	}

	/**
	 * Save custom field values for a specific entity (record)
	 * @param context
	 * @param itemId
	 * @param customFields
	 * @description Saves or updates custom field values for a specific entity instance
	 */
	@Post('values/:context/:itemId')
	@UseGuards(AuthGuard, RoleGuard)
	@Roles(UserRole.ADMIN)
	@ApiOperation({
		summary: 'Save custom field values for entity',
		description:
			'Saves or updates custom field values for a specific entity instance',
	})
	@ApiParam({
		name: 'context',
		enum: FieldContext,
		description: 'Entity context (USERS, COHORTS, etc.)',
	})
	@ApiParam({
		name: 'itemId',
		type: String,
		format: 'uuid',
		description: 'Entity instance ID (UUID)',
	})
	@ApiBody({
		type: [CustomFieldDto],
		description: 'Array of custom field values to save',
	})
	@ApiResponse({
		status: 200,
		description: 'Custom field values saved successfully',
		type: Object, // Could be FieldValue[] or a DTO if needed
	})
	async saveCustomFields(
		@Param('context') context: FieldContext,
		@Param('itemId', ParseUUIDPipe) itemId: string,
		@Body() customFields: CustomFieldDto[]
	): Promise<any> {
		return this.customFieldsService.saveCustomFields(
			itemId,
			context,
			customFields
		);
	}

	/**
	 * Search entities by custom field values
	 * @param context
	 * @param searchDto
	 * @param searchDto.searchCriteria
	 * @description Searches for entity IDs that match specific custom field criteria
	 */
	@Post('search/:context')
	@ApiOperation({
		summary: 'Search entities by custom fields',
		description:
			'Searches for entity IDs that match specific custom field criteria',
	})
	@ApiParam({
		name: 'context',
		enum: FieldContext,
		description: 'Entity context to search in',
	})
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				searchCriteria: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							fieldId: { type: 'string', format: 'uuid' },
							value: { type: 'string' },
						},
						required: ['fieldId', 'value'],
					},
				},
			},
			required: ['searchCriteria'],
		},
		examples: {
			searchByBloodGroup: {
				summary: 'Search by Blood Group',
				value: {
					searchCriteria: [
						{
							fieldId: '550e8400-e29b-41d4-a716-446655440000',
							value: 'a_positive',
						},
					],
				},
			},
			multiFieldSearch: {
				summary: 'Multiple Field Search',
				value: {
					searchCriteria: [
						{
							fieldId: '550e8400-e29b-41d4-a716-446655440000',
							value: 'a_positive',
						},
						{
							fieldId: '550e8400-e29b-41d4-a716-446655440001',
							value: 'District A',
						},
					],
				},
			},
		},
	})
	@ApiResponse({
		status: 200,
		description: 'Search completed successfully',
		schema: {
			type: 'object',
			properties: {
				itemIds: {
					type: 'array',
					items: { type: 'string', format: 'uuid' },
				},
				total: { type: 'number' },
			},
		},
	})
	async searchByCustomFields(
		@Param('context') context: FieldContext,
		@Body()
		searchDto: {
			searchCriteria: { fieldId: string; value: any }[];
		}
	): Promise<{ itemIds: string[]; total: number }> {
		const itemIds = await this.customFieldsService.searchByCustomFields(
			context,
			searchDto.searchCriteria
		);

		return {
			itemIds,
			total: itemIds.length,
		};
	}

	/**
	 * Get field usage statistics
	 * @param context
	 * @description Retrieves statistics about field usage in a specific context
	 */
	@Get('statistics/:context')
	@ApiOperation({
		summary: 'Get field usage statistics',
		description:
			'Retrieves statistics about field usage and value counts in a specific context',
	})
	@ApiParam({
		name: 'context',
		enum: FieldContext,
		description: 'Entity context for statistics',
	})
	@ApiResponse({
		status: 200,
		description: 'Statistics retrieved successfully',
		schema: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					fieldId: { type: 'string', format: 'uuid' },
					name: { type: 'string' },
					label: { type: 'string' },
					type: { type: 'string' },
					valueCount: { type: 'number' },
					isRequired: { type: 'boolean' },
					isHidden: { type: 'boolean' },
				},
			},
		},
	})
	async getFieldStatistics(
		@Param('context') context: FieldContext
	): Promise<any> {
		return this.customFieldsService.getFieldStatistics(context);
	}
}
