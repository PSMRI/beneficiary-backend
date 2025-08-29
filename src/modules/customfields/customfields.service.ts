import {
	Injectable,
	NotFoundException,
	ConflictException,
	BadRequestException,
	Logger,
	ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	Repository,
	FindOptionsWhere,
	In,
	DeleteResult,
	UpdateResult,
	DataSource,
} from 'typeorm';
import { Field, FieldContext } from './entities/field.entity';
import { FieldValue } from './entities/field-value.entity';
import { CreateFieldDto } from './dto/create-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { CustomFieldDto, CustomFieldResponseDto } from './dto/custom-field.dto';
import { QueryFieldsDto } from './dto/query-fields.dto';
import { AdminService } from '../admin/admin.service';
import { FieldEncryptionHelper } from './helpers/field-encryption.helper';
import { FieldValidationHelper } from './helpers/field-validation.helper';

/**
 * Service for managing custom fields and field values
 * @description Handles CRUD operations for fields and field values,
 * provides integration methods for other entities
 */
@Injectable()
export class CustomFieldsService {
	private readonly logger = new Logger(CustomFieldsService.name);

	constructor(
		@InjectRepository(Field)
		private readonly fieldRepository: Repository<Field>,
		@InjectRepository(FieldValue)
		private readonly fieldValueRepository: Repository<FieldValue>,
		private readonly dataSource: DataSource,
		private readonly adminService: AdminService,
		private readonly fieldEncryptionHelper: FieldEncryptionHelper,
		private readonly fieldValidationHelper: FieldValidationHelper,
	) { }

	/**
	 * Create a new custom field
	 * @param createFieldDto Field creation data
	 * @returns Created field
	 */
	async createField(createFieldDto: CreateFieldDto): Promise<Field> {
		this.logger.debug(`Creating field: ${createFieldDto.name}`);

		// Check if field with same name and context already exists
		const existingField = await this.fieldRepository.findOne({
			where: {
				name: createFieldDto.name,
				context: createFieldDto.context,
			},
		});

		if (existingField) {
			throw new ConflictException(
				`Field with name "${createFieldDto.name}" already exists in context "${createFieldDto.context}"`
			);
		}

		const field = this.fieldRepository.create(createFieldDto);
		const savedField = await this.fieldRepository.save(field);

		this.logger.log(`Field created successfully: ${savedField.fieldId}`);
		return savedField;
	}

	/**
	 * Get all fields with optional filtering
	 * @param queryDto Query parameters for filtering
	 * @returns Array of fields
	 */
	async findFields(queryDto: QueryFieldsDto = {}): Promise<Field[]> {
		this.logger.debug('Finding fields with filters:', queryDto);

		const where: FindOptionsWhere<Field> = {};

		if (queryDto.context) {
			where.context = queryDto.context;
		}

		if (queryDto.contextType) {
			where.contextType = queryDto.contextType;
		}

		if (queryDto.isRequired !== undefined) {
			where.isRequired = queryDto.isRequired;
		}

		if (queryDto.isHidden !== undefined) {
			where.isHidden = queryDto.isHidden;
		}

		const fields = await this.fieldRepository.find({
			where,
			order: {
				ordering: 'ASC',
				name: 'ASC',
			},
		});

		// Filter data fields if specified
		if (queryDto.filterDataFields) {
			const allowedFields = [
				'name',
				'label',
				'type',
				'context',
				'contextType',
				'dependsOn',
				'ordering',
				'isRequired',
				'isHidden',
			];

			const requestedFields = queryDto.filterDataFields
				.split(',')
				.map((field) => field.trim())
				.filter((field) => allowedFields.includes(field));

			if (requestedFields.length > 0) {
				return fields.map((field) => {
					const filteredField: any = {};
					requestedFields.forEach((fieldName) => {
						if (fieldName in field) {
							filteredField[fieldName] = field[fieldName];
						}
					});
					return filteredField;
				});
			}
		}

		this.logger.debug(`Found ${fields.length} fields`);
		return fields;
	}

	/**
	 * Get a single field by ID
	 * @param fieldId Field ID
	 * @returns Field entity
	 */
	async findFieldById(fieldId: string): Promise<Field> {
		this.logger.debug(`Finding field by ID: ${fieldId}`);

		const field = await this.fieldRepository.findOne({
			where: { fieldId },
		});

		if (!field) {
			throw new NotFoundException(`Field with ID ${fieldId} not found`);
		}

		return field;
	}

	/**
	 * Update a field
	 * @param fieldId Field ID
	 * @param updateFieldDto Update data
	 * @returns Updated field
	 */
	async updateField(
		fieldId: string,
		updateFieldDto: UpdateFieldDto
	): Promise<Field> {
		this.logger.debug(`Updating field: ${fieldId}`);

		const field = await this.findFieldById(fieldId);

		await this.ensureFieldNameIsUnique(field, updateFieldDto, fieldId);
		await this.handleEncryptionChange(field, updateFieldDto, fieldId);

		Object.assign(field, updateFieldDto);
		const savedField = await this.fieldRepository.save(field);

		this.logger.log(`Field updated successfully: ${fieldId}`);
		return savedField;
	}

	private async ensureFieldNameIsUnique(
		field: Field,
		updateFieldDto: UpdateFieldDto,
		fieldId: string
	): Promise<void> {
		if (updateFieldDto.name && updateFieldDto.name !== field.name) {
			const existingField = await this.fieldRepository.findOne({
				where: {
					name: updateFieldDto.name,
					context: field.context,
				},
			});

			if (existingField && existingField.fieldId !== fieldId) {
				throw new ConflictException(
					`Field with name "${updateFieldDto.name}" already exists in context "${field.context}"`
				);
			}
		}
	}

	private async handleEncryptionChange(
		field: Field,
		updateFieldDto: UpdateFieldDto,
		fieldId: string
	): Promise<void> {
		if (updateFieldDto.fieldAttributes?.isEncrypted === undefined) {
			return;
		}
		const existingValuesCount = await this.fieldValueRepository.count({
			where: { fieldId },
		});

		const isEnabling = updateFieldDto.fieldAttributes.isEncrypted && !field.isEncrypted();
		const isDisabling = !updateFieldDto.fieldAttributes.isEncrypted && field.isEncrypted();

		if (isEnabling) {
			if (!this.canEnableEncryption(field, existingValuesCount > 0)) {
				throw new BadRequestException(
					`Cannot enable encryption for field '${field.name}' because it has ${existingValuesCount} existing values.`
				);
			}
		} else if (isDisabling) {
			if (!this.canDisableEncryption(field, existingValuesCount > 0)) {
				if (existingValuesCount > 0) {
					throw new BadRequestException(
						`Cannot disable encryption for field '${field.name}' because it has ${existingValuesCount} existing values.`
					);
				} else {
					throw new BadRequestException(
						`Cannot disable encryption for field '${field.name}'. Field is not currently encrypted.`
					);
				}
			}
		}
	}

	/**
	 * Delete a field and all its values
	 * @param fieldId Field ID
	 * @returns Delete result with counts
	 */
	async deleteField(fieldId: string): Promise<{ fieldDeleted: number; valuesDeleted: number }> {
		this.logger.debug(`Deleting field: ${fieldId}`);

		// Check if field is mapped in settings before proceeding
		try {
			const mappingConfig = await this.adminService.getConfigByKey('profileFieldToDocumentFieldMapping');
			
			if (mappingConfig?.value) {
				const mappings = Array.isArray(mappingConfig.value) ? mappingConfig.value : [];
				const fieldMapping = mappings.find((mapping: any) => mapping.fieldId === fieldId);
				
				if (fieldMapping) {
					throw new ForbiddenException(
						`Field "${fieldMapping.fieldName}" (ID: ${fieldId}) is mapped to document fields. Please remove the mapping from settings before deleting this field.`
					);
				}
			}
		} catch (error) {
			// If error is ForbiddenException, re-throw it
			if (error instanceof ForbiddenException) {
				throw error;
			}
			
			// Log other errors but continue with deletion
			this.logger.warn(`Error checking field mappings: ${error.message}`);
		}

		// Use transaction to ensure data consistency
		return await this.dataSource.transaction(async (manager) => {
			// Check if field exists
			const field = await manager.findOne(Field, {
				where: { fieldId },
			});

			if (!field) {
				throw new NotFoundException(
					`Field with ID ${fieldId} not found`
				);
			}

			// Delete all field values for this field
			const valuesDeleteResult = await manager.delete(FieldValue, { fieldId });

			// Delete the field
			const fieldDeleteResult = await manager.delete(Field, { fieldId });

			this.logger.log(
				`Field deleted successfully: ${fieldId}. Deleted ${fieldDeleteResult.affected} field and ${valuesDeleteResult.affected} field values`
			);

			return {
				fieldDeleted: fieldDeleteResult.affected || 0,
				valuesDeleted: valuesDeleteResult.affected || 0,
			};
		});
	}

	/**
	 * Create or update field values for an entity
	 * @param itemId Entity ID (UUID)
	 * @param context Entity context
	 * @param customFields Array of custom field data
	 * @returns Array of created/updated field values
	 */
	async saveCustomFields(
		itemId: string,
		context: FieldContext,
		customFields: CustomFieldDto[]
	): Promise<FieldValue[]> {

		this.logger.debug(
			`Saving custom fields for item: ${itemId}, context: ${context}`
		);

		if (!customFields || customFields.length === 0) {
			return [];
		}

		// Validate that all fields exist and belong to the correct context
		const fieldIds = customFields.map((cf) => cf.fieldId);
		const fields = await this.fieldRepository.find({
			where: {
				fieldId: In(fieldIds),
				context,
			},
		});

		if (fields.length !== fieldIds.length) {
			const foundIds = fields.map((f) => f.fieldId);
			const missingIds = fieldIds.filter((id) => !foundIds.includes(id));
			throw new BadRequestException(
				`Invalid field IDs: ${missingIds.join(', ')}`
			);
		}

		// Get all existing field values for this itemId
		const existingValues = await this.fieldValueRepository.find({
			where: { itemId },
		});

		const existingFieldIds = existingValues.map((fv) => fv.fieldId);
		const incomingFieldIds = new Set(fieldIds);

		// 1. Delete rows for fieldIds not in incoming list
		const toDelete = existingFieldIds.filter((fid) => !incomingFieldIds.has(fid));
		if (toDelete.length > 0) {
			await this.fieldValueRepository.delete({ itemId, fieldId: In(toDelete) });
		}

		const savedValues: FieldValue[] = [];

		for (const customField of customFields) {
			const field = fields.find((f) => f.fieldId === customField.fieldId);
			if (!field) continue;

			// 2. If exists, update; 3. If not, insert
			let fieldValue = existingValues.find(
				(fv) => fv.fieldId === customField.fieldId && fv.itemId === itemId
			);

			if (!fieldValue) {
				fieldValue = this.fieldValueRepository.create({
					fieldId: customField.fieldId,
					itemId,
				});
			}

			fieldValue.field = field;
			fieldValue.metadata = customField.metadata;

			// Always validate first using centralized validation service
			this.fieldValidationHelper.validateFieldValue(
				customField.value,
				field,
				true // Throw exception on validation error
			);

			// Handle value setting using centralized serialization
			if (field.isEncrypted()) {
				const encryptedValue = this.fieldEncryptionHelper.encryptFieldValue(customField.value, field);
				fieldValue.setEncryptedValue(encryptedValue);
			} else {
				// Use centralized serialization for consistency
				const serializedValue = this.fieldValidationHelper.serializeValue(customField.value, field.type);
				fieldValue.value = serializedValue;
			}

			const savedValue = await this.fieldValueRepository.save(fieldValue);
			savedValues.push(savedValue);
		}

		this.logger.log(
			`Saved ${savedValues.length} custom field values for item: ${itemId}`
		);
		return savedValues;

	}

	/**
	 * Get custom fields for an entity
	 * @param itemId Entity ID (UUID)
	 * @param context Entity context
	 * @returns Array of custom field response DTOs
	 */
	async getCustomFields(
		itemId: string,
		context: FieldContext
	): Promise<CustomFieldResponseDto[]> {
		this.logger.debug(
			`Getting custom fields for item: ${itemId}, context: ${context}`
		);

		// Get ALL fields for this context (excluding hidden fields)
		const allFields = await this.fieldRepository.find({
			where: { 
				context,
				isHidden: false 
			},
			order: {
				ordering: 'ASC'
			},
		});

		// Get field values for this specific item
		const fieldValues = await this.fieldValueRepository.find({
			where: { itemId },
			relations: ['field'],
		});

		// Create a map of field values for quick lookup
		const fieldValueMap = new Map<string, FieldValue>();
		fieldValues.forEach(fv => {
			if (fv.field && fv.field.context === context) {
				fieldValueMap.set(fv.fieldId, fv);
			}
		});

		// Create response DTOs - include ALL fields, with null values for missing ones
		const responseFields: CustomFieldResponseDto[] = [];

		for (const field of allFields) {
			const fieldValue = fieldValueMap.get(field.fieldId);

			// Get value using centralized deserialization
			let decryptedValue = null;
			if (fieldValue) {
				decryptedValue = field.isEncrypted() 
									? this.fieldEncryptionHelper.decryptFieldValue(fieldValue.value, field)
				: this.fieldValidationHelper.deserializeValue(fieldValue.value, field.type);
			}

			const response: CustomFieldResponseDto = {
				fieldId: field.fieldId,
				name: field.name,
				label: field.label,
				type: field.type,
				value: decryptedValue,
				fieldParams: field.fieldParams,
				fieldAttributes: field.fieldAttributes,
				metadata: fieldValue?.metadata || null,
				isRequired: field.isRequired,
				isHidden: field.isHidden,
				ordering: field.ordering,
			};

			responseFields.push(response);
		}

		this.logger.debug(
			`Retrieved ${responseFields.length} custom fields for item: ${itemId} (${fieldValueMap.size} have values)`
		);
		return responseFields;
	}

	/**
	 * Delete custom fields for an entity
	 * @param itemId Entity ID (UUID)
	 * @param context Entity context
	 * @param fieldIds Optional array of field IDs to delete specific fields
	 * @returns Delete result
	 */
	async deleteCustomFields(
		itemId: string,
		context: FieldContext,
		fieldIds?: string[]
	): Promise<DeleteResult> {
		this.logger.debug(
			`Deleting custom fields for item: ${itemId}, context: ${context}`
		);

		const where: FindOptionsWhere<FieldValue> = {
			itemId,
		};

		if (fieldIds && fieldIds.length > 0) {
			where.fieldId = In(fieldIds);
		} else {
			// Get all field IDs for this context
			const fields = await this.fieldRepository.find({
				where: { context },
				select: ['fieldId'],
			});
			where.fieldId = In(fields.map((f) => f.fieldId));
		}

		const result = await this.fieldValueRepository.delete(where);
		this.logger.log(`Deleted custom fields for item: ${itemId}`);
		return result;
	}

	/**
	 * Search entities by custom field values
	 * @param context Entity context
	 * @param searchCriteria Search criteria
	 * @returns Array of entity IDs that match the criteria
	 */
	async searchByCustomFields(
		context: FieldContext,
		searchCriteria: { fieldId: string; value: any }[]
	): Promise<string[]> {
		this.logger.debug(`Searching by custom fields in context: ${context}`);

		if (!searchCriteria || searchCriteria.length === 0) {
			return [];
		}

		// Build the query
		const queryBuilder = this.fieldValueRepository
			.createQueryBuilder('fv')
			.select('fv.itemId')
			.innerJoin('fv.field', 'f')
			.where('f.context = :context', { context });

		// Add search criteria
		const conditions = searchCriteria.map((criteria, index) => {
			const fieldParam = `fieldId${index}`;
			const valueParam = `value${index}`;

			queryBuilder.setParameter(fieldParam, criteria.fieldId);
			queryBuilder.setParameter(valueParam, criteria.value);

			return `(fv.fieldId = :${fieldParam} AND fv.value = :${valueParam})`;
		});

		queryBuilder.andWhere(`(${conditions.join(' OR ')})`);

		const results = await queryBuilder.getMany();
		const itemIds = [...new Set(results.map((r) => r.itemId))];

		this.logger.debug(
			`Found ${itemIds.length} items matching custom field criteria`
		);
		return itemIds;
	}

	/**
	 * Get field statistics
	 * @param context Entity context
	 * @returns Field usage statistics
	 */
	async getFieldStatistics(context: FieldContext): Promise<any> {
		this.logger.debug(`Getting field statistics for context: ${context}`);

		const fields = await this.fieldRepository.find({
			where: { context },
		});

		const statistics = await Promise.all(
			fields.map(async (field) => {
				const valueCount = await this.fieldValueRepository.count({
					where: {
						fieldId: field.fieldId,
					},
				});

				return {
					fieldId: field.fieldId,
					name: field.name,
					label: field.label,
					type: field.type,
					valueCount,
					isRequired: field.isRequired,
					isHidden: field.isHidden,
				};
			})
		);

		this.logger.debug(
			`Generated statistics for ${statistics.length} fields`
		);
		return statistics;
	}

	async setFieldValueToNull(itemId: string, fieldId: string): Promise<UpdateResult> {
		return await this.fieldValueRepository.update({ itemId, fieldId }, { value: null });
	}

	async getFieldByName(name: string, context: FieldContext): Promise<Field> {
		return await this.fieldRepository.findOne({ where: { name, context } });
	}

		/**
	 * Check if a field can have encryption enabled
	 * @param field The field to check
	 * @param hasExistingValues Whether the field has existing values
	 * @returns true if encryption can be enabled
	 */
		canEnableEncryption(field: Field, hasExistingValues: boolean): boolean {
			if (field.isEncrypted()) {
				return false; // Already encrypted
			}
	
			if (hasExistingValues) {
				return false; // Cannot enable encryption for fields with existing values
			}
	
			return true;
		}
	
		/**
		 * Check if a field can have encryption disabled
		 * @param field The field to check
		 * @param hasExistingValues Whether the field has existing values
		 * @returns true if encryption can be disabled
		 */
		canDisableEncryption(field: Field, hasExistingValues: boolean): boolean {
			// Encryption can only be disabled if the field is currently encrypted
			if (!field.isEncrypted()) {
				return false; // Not encrypted, so nothing to disable
			}
	
			// Encryption can only be disabled if there are no existing values
			if (hasExistingValues) {
				return false; // Cannot disable encryption for fields with existing values
			}
	
			return true; // Can disable encryption if no existing values
		}


}
