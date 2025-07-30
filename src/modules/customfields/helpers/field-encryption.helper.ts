import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../../common/helper/encryptionService';
import { Field } from '../entities/field.entity';
import { FieldValidationHelper } from './field-validation.helper';

/**
 * Helper for handling encryption and decryption of custom field values
 * @description Provides transparent encryption/decryption for sensitive field values
 */
@Injectable()
export class FieldEncryptionHelper {
	private readonly logger = new Logger(FieldEncryptionHelper.name);
	private readonly encryptionService: EncryptionService;

	constructor(
		private readonly configService: ConfigService,
		private readonly fieldValidationHelper: FieldValidationHelper,
	) {
		this.encryptionService = EncryptionService.getInstance(configService);
	}

	/**
	 * Encrypt a field value if the field is configured for encryption
	 * @param value The value to encrypt (assumed to be already validated)
	 * @param field The field definition
	 * @returns Encrypted value as string, or original value if encryption is not enabled
	 */
	encryptFieldValue(value: any, field: Field): string {
		if (!field.isEncrypted()) {
			return this.fieldValidationHelper.serializeValue(value, field.type);
		}

		try {
			// Serialize the value according to field type (validation already done in service layer)
			const serializedValue = this.fieldValidationHelper.serializeValue(value, field.type);
			
			// Encrypt the serialized value
			const encryptedValue = this.encryptionService.encrypt(serializedValue);
			
			this.logger.debug(`Encrypted value for field ${field.name} (${field.fieldId})`);
			return encryptedValue;
		} catch (error) {
			this.logger.error(`Failed to encrypt value for field ${field.name}: ${error.message}`, error.stack);
			throw new BadRequestException(`Failed to encrypt field value: ${error.message}`);
		}
	}

	/**
	 * Decrypt a field value if the field is configured for encryption
	 * @param encryptedValue The encrypted value from database
	 * @param field The field definition
	 * @returns Decrypted and parsed value, or original value if encryption is not enabled
	 */
	decryptFieldValue(encryptedValue: string, field: Field): any {
		if (!field.isEncrypted()) {
			return this.fieldValidationHelper.deserializeValue(encryptedValue, field.type);
		}

		if (!encryptedValue) {
			return null;
		}

		try {
			// Decrypt the value
			const decryptedValue = this.encryptionService.decrypt(encryptedValue);
			
			// Deserialize according to field type
			const parsedValue = this.fieldValidationHelper.deserializeValue(decryptedValue, field.type);
			
			this.logger.debug(`Decrypted value for field ${field.name} (${field.fieldId})`);
			return parsedValue;
		} catch (error) {
			this.logger.error(`Failed to decrypt value for field ${field.name}: ${error.message}`, error.stack);
			throw new BadRequestException(`Failed to decrypt field value: ${error.message}`);
		}
	}
} 