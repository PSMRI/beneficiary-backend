import { Injectable, BadRequestException } from '@nestjs/common';
import { Field, FieldType } from '../entities/field.entity';

export interface ValidationResult {
	isValid: boolean;
	errors: string[];
}

export interface ValidationOptions {
	strictTypeValidation?: boolean; // If true, enforce strict type validation for text fields
}

/**
 * Centralized helper for field validation
 * @description Provides comprehensive validation for custom field values
 */
@Injectable()
export class FieldValidationHelper {
	/**
	 * Validate a field value against all constraints
	 * @param value The value to validate
	 * @param field The field definition
	 * @param throwOnError Whether to throw exception on validation error
	 * @param options Additional validation options
	 * @returns ValidationResult object with validation status and errors
	 */
	validateFieldValue(
		value: any,
		field: Field,
		throwOnError = false,
		options: ValidationOptions = {},
	): ValidationResult {
		const errors: string[] = [];

		if (!field) {
			return { isValid: true, errors: [] };
		}

		// Check required validation
		const requiredError = this.validateRequired(value, field);
		if (requiredError) {
			errors.push(requiredError);
		}

		// If value is empty and not required, skip other validations
		if (this.isEmptyValue(value) && !field.isRequired) {
			const result = { isValid: errors.length === 0, errors };
			if (throwOnError && !result.isValid) {
				throw new BadRequestException(errors.join('; '));
			}
			return result;
		}

		// Validate field type
		const typeError = this.validateFieldType(value, field.type, options);
		if (typeError) {
			errors.push(typeError);
		}

		// Validate field parameters (validation rules)
		const paramErrors = this.validateFieldParameters(value, field);
		errors.push(...paramErrors);

		// Validate options for drop-down and radio fields
		const optionError = this.validateOptions(value, field);
		if (optionError) {
			errors.push(optionError);
		}

		const result = { isValid: errors.length === 0, errors };

		if (throwOnError && !result.isValid) {
			throw new BadRequestException(errors.join('; '));
		}

		return result;
	}

	/**
	 * Validate required field constraint
	 * @param value The value to validate
	 * @param field The field definition
	 * @returns Error message if validation fails, null otherwise
	 */
	private validateRequired(value: any, field: Field): string | null {
		if (field.isRequired && this.isEmptyValue(value)) {
			return `Field '${field.name}' is required and cannot be empty`;
		}
		return null;
	}

	/**
	 * Validate value against field type constraints
	 * @param value The value to validate
	 * @param fieldType The field type
	 * @param options Validation options
	 * @returns Error message if validation fails, null otherwise
	 */
	private validateFieldType(value: any, fieldType: FieldType, options: ValidationOptions = {}): string | null {
		if (this.isEmptyValue(value)) {
			return null; // Empty values are handled by required validation
		}

		switch (fieldType) {
			case FieldType.NUMERIC:
			case FieldType.CURRENCY:
			case FieldType.PERCENT:
			case FieldType.RATING:
				return this.validateNumericType(value, fieldType);

			case FieldType.TEXT:
			case FieldType.TEXTAREA:
				return this.validateTextType(value, fieldType, options);

			case FieldType.EMAIL:
				return this.validateEmailType(value);

			case FieldType.PHONE:
				return this.validatePhoneType(value);

			case FieldType.URL:
				return this.validateUrlType(value);

			case FieldType.DATE:
			case FieldType.DATETIME:
				return this.validateDateType(value, fieldType);

			case FieldType.CHECKBOX:
				return this.validateCheckboxType(value, fieldType);

			case FieldType.MULTI_SELECT:
			case FieldType.JSON:
				return this.validateJsonType(value, fieldType);

			case FieldType.FILE:
				return this.validateFileType(value, fieldType);

			default:
				// Unknown field type - should not happen, but accept any value
				return null;
		}
	}

	/**
	 * Validate numeric field types
	 */
	private validateNumericType(value: any, fieldType: FieldType): string | null {
		if (isNaN(Number(value))) {
			return `Value must be a valid number for field type ${fieldType}`;
		}
		return null;
	}

	/**
	 * Validate email field type
	 */
	private validateEmailType(value: any): string | null {
		if (!this.isValidEmail(String(value))) {
			return `Value must be a valid email address`;
		}
		return null;
	}

	/**
	 * Validate phone field type
	 */
	private validatePhoneType(value: any): string | null {
		if (!this.isValidPhone(String(value))) {
			return `Value must be a valid phone number`;
		}
		return null;
	}

	/**
	 * Validate URL field type
	 */
	private validateUrlType(value: any): string | null {
		if (!this.isValidUrl(String(value))) {
			return `Value must be a valid URL`;
		}
		return null;
	}

	/**
	 * Validate date field types
	 */
	private validateDateType(value: any, fieldType: FieldType): string | null {
		const date = new Date(value);
		if (isNaN(date.getTime())) {
			return `Value must be a valid date for field type ${fieldType}`;
		}
		return null;
	}

	/**
	 * Validate checkbox field type
	 */
	private validateCheckboxType(value: any, fieldType: FieldType): string | null {
		if (
			typeof value !== 'boolean' &&
			!['true', 'false', '0', '1'].includes(String(value).toLowerCase())
		) {
			return `Value must be a valid boolean for field type ${fieldType}`;
		}
		return null;
	}

	/**
	 * Validate JSON field types
	 */
	private validateJsonType(value: any, fieldType: FieldType): string | null {
		try {
			if (typeof value === 'string') {
				JSON.parse(value);
			} else {
				JSON.stringify(value);
			}
			return null;
		} catch {
			// JSON parsing failed
			return `Value must be valid JSON for field type ${fieldType}`;
		}
	}
	/**
	 * Validate text field types
	 */
	private validateTextType(value: any, fieldType: FieldType, options: ValidationOptions = {}): string | null {
		// For strict validation mode
		if (options.strictTypeValidation) {
			if (typeof value === 'number') {
				return `Value must be text, not a number for field type ${fieldType}`;
			}
			
			if (typeof value === 'object' && value !== null) {
				return `Value must be text, not an object for field type ${fieldType}`;
			}
			
			if (typeof value === 'boolean') {
				return `Value must be text, not a boolean for field type ${fieldType}`;
			}
		}

		// In non-strict mode, allow automatic conversion but warn if value is not a string
		// This maintains backward compatibility while still providing validation feedback
		if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			return `Complex objects are not supported for text fields. Use JSON field type instead.`;
		}

		// Accept strings, numbers (will be converted), booleans (will be converted), null, undefined
		return null;
	}

	/**
	 * Validate file field type
	 */
	private validateFileType(value: any, fieldType: FieldType): string | null {
		// For file fields, we typically store file metadata or file paths as strings
		// The actual file content is usually stored separately
		if (typeof value !== 'string' && value !== null && value !== undefined) {
			return `File field must contain a string value (file path or metadata) for field type ${fieldType}`;
		}
		return null;
	}

	/**
	 * Validate value against field parameters (validation rules)
	 * @param value The value to validate
	 * @param field The field definition
	 * @returns Array of error messages
	 */
	private validateFieldParameters(value: any, field: Field): string[] {
		const errors: string[] = [];

		if (!field.fieldParams?.validation || this.isEmptyValue(value)) {
			return errors;
		}

		const validation = field.fieldParams.validation;
		const stringValue = String(value);

		// Validate regex pattern
		const regexError = this.validateRegex(stringValue, validation, field.name);
		if (regexError) {
			errors.push(regexError);
		}

		// Validate string length constraints
		const lengthErrors = this.validateLength(stringValue, validation, field.name);
		errors.push(...lengthErrors);

		// Validate numeric range constraints
		const rangeError = this.validateNumericRange(stringValue, validation, field);
		if (rangeError) {
			errors.push(rangeError);
		}

		return errors;
	}

	/**
	 * Validate regex pattern
	 * @param stringValue String value to validate
	 * @param validation Validation rules
	 * @param fieldName Field name for error message
	 * @returns Error message if validation fails, null otherwise
	 */
	private validateRegex(
		stringValue: string,
		validation: any,
		fieldName: string,
	): string | null {
		if (validation.regex && stringValue) {
			try {
				const regex = new RegExp(validation.regex);
				if (!regex.test(stringValue)) {
					return `Value does not match required pattern for field '${fieldName}'`;
				}
			} catch {
				return `Invalid regex pattern configured for field '${fieldName}'`;
			}
		}
		return null;
	}

	/**
	 * Validate string length constraints
	 * @param stringValue String value to validate
	 * @param validation Validation rules
	 * @param fieldName Field name for error message
	 * @returns Array of error messages
	 */
	private validateLength(
		stringValue: string,
		validation: any,
		fieldName: string,
	): string[] {
		const errors: string[] = [];

		if (validation.minLength && stringValue) {
			if (stringValue.length < validation.minLength) {
				errors.push(
					`Value is too short for field '${fieldName}'. Minimum length is ${validation.minLength}`,
				);
			}
		}

		if (validation.maxLength && stringValue) {
			if (stringValue.length > validation.maxLength) {
				errors.push(
					`Value is too long for field '${fieldName}'. Maximum length is ${validation.maxLength}`,
				);
			}
		}

		return errors;
	}

	/**
	 * Validate numeric range constraints
	 * @param stringValue String value to validate
	 * @param validation Validation rules
	 * @param field Field definition
	 * @returns Error message if validation fails, null otherwise
	 */
	private validateNumericRange(
		stringValue: string,
		validation: any,
		field: Field,
	): string | null {
		if (
			field.type === FieldType.NUMERIC ||
			field.type === FieldType.CURRENCY ||
			field.type === FieldType.PERCENT ||
			field.type === FieldType.RATING
		) {
			const numValue = parseFloat(stringValue);
			if (!isNaN(numValue)) {
				if (validation.min !== undefined && numValue < validation.min) {
					return `Value is too small for field '${field.name}'. Minimum value is ${validation.min}`;
				}
				if (validation.max !== undefined && numValue > validation.max) {
					return `Value is too large for field '${field.name}'. Maximum value is ${validation.max}`;
				}
			}
		}
		return null;
	}

	/**
	 * Validate options constraints for drop-down and radio fields
	 * @param value The value to validate
	 * @param field The field definition
	 * @returns Error message if validation fails, null otherwise
	 */
	private validateOptions(value: any, field: Field): string | null {
		if (
			(field.type === FieldType.DROP_DOWN || field.type === FieldType.RADIO) &&
			field.fieldParams?.options &&
			!this.isEmptyValue(value)
		) {
			const validOptions = field.fieldParams.options.map((opt: any) => opt.value);
			if (!validOptions.includes(value)) {
				return `Invalid option selected for field '${field.name}'. Valid options are: ${validOptions.join(', ')}`;
			}
		}
		return null;
	}

	/**
	 * Check if a value is considered empty
	 * @param value The value to check
	 * @returns true if value is empty
	 */
	private isEmptyValue(value: any): boolean {
		return (
			value === null ||
			value === undefined ||
			(typeof value === 'string' && value.trim() === '')
		);
	}

	/**
	 * Validate email format
	 * @param email Email to validate
	 * @returns true if email is valid
	 */
	private isValidEmail(email: string): boolean {
		// Use a more efficient regex that avoids catastrophic backtracking
		// This pattern is more restrictive but safe from ReDoS attacks
		const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
		return emailRegex.test(email);
	}

	/**
	 * Validate phone number format
	 * @param phone Phone number to validate
	 * @returns true if phone is valid
	 */
	private isValidPhone(phone: string): boolean {
		// Basic phone validation - adjust regex based on requirements
		const phoneRegex = /^[+]?[1-9]\d{0,15}$/;
		return phoneRegex.test(phone.replace(/[\s\-()]/g, ''));
	}

	/**
	 * Validate URL format
	 * @param url URL to validate
	 * @returns true if URL is valid
	 */
	private isValidUrl(url: string): boolean {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Serialize a value according to field type for storage
	 * @param value The value to serialize
	 * @param fieldType The field type
	 * @returns Serialized value as string
	 */
	serializeValue(value: any, fieldType: FieldType): string {
		if (value === null || value === undefined) {
			return null;
		}

		switch (fieldType) {
			case FieldType.TEXT:
			case FieldType.TEXTAREA:
				// Convert to string but validation should have already checked the type
				return String(value);

			case FieldType.MULTI_SELECT:
			case FieldType.JSON:
				return typeof value === 'string' ? value : JSON.stringify(value);

			case FieldType.CHECKBOX:
				return Boolean(value).toString();

			case FieldType.DATE:
				if (value instanceof Date) {
					return value.toISOString().split('T')[0];
				}
				return String(value);

			case FieldType.DATETIME:
				if (value instanceof Date) {
					return value.toISOString();
				}
				return String(value);

			case FieldType.NUMERIC:
			case FieldType.CURRENCY:
			case FieldType.PERCENT:
			case FieldType.RATING:
				return String(value);

			case FieldType.EMAIL:
			case FieldType.PHONE:
			case FieldType.URL:
			case FieldType.FILE:
				// These should be strings
				return String(value);

			default:
				return String(value);
		}
	}

	/**
	 * Deserialize a value according to field type
	 * @param serializedValue The serialized value from storage
	 * @param fieldType The field type
	 * @returns Deserialized value
	 */
	deserializeValue(serializedValue: string, fieldType: FieldType): any {
		if (!serializedValue) {
			return null;
		}

		switch (fieldType) {
			case FieldType.NUMERIC:
			case FieldType.CURRENCY:
			case FieldType.PERCENT:
			case FieldType.RATING:
				return parseFloat(serializedValue);

			case FieldType.DATE:
			case FieldType.DATETIME:
				return new Date(serializedValue);

			case FieldType.CHECKBOX:
				return serializedValue === 'true';

			case FieldType.MULTI_SELECT:
			case FieldType.JSON:
				try {
					return JSON.parse(serializedValue);
				} catch {
					return serializedValue;
				}

			default:
				return serializedValue;
		}
	}
} 