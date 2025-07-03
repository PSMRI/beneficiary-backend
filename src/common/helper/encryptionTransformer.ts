import { ValueTransformer } from 'typeorm';
import { EncryptionService } from './encryptionService';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

const logger = new Logger('EncryptionTransformer');
/**
 * TypeORM ValueTransformer for automatic encryption/decryption of database fields.
 * 
 * Usage: Add @Column({ transformer: EncryptionTransformer }) to entity properties
 * that need to be encrypted in the database.
 * 
 * Features:
 * - Automatically encrypts data before saving to database
 * - Automatically decrypts data when reading from database
 * - Uses AES-256-GCM encryption for secure data storage
 * - Uses singleton pattern for compatibility with NestJS dependency injection
 */
export const EncryptionTransformer = (configService: ConfigService): ValueTransformer => ({
  /**
   * Transforms data before saving to database (encrypts the value).
   * 
   * @param value - The original value to encrypt
   * @returns Encrypted base64 string or original value if null/undefined
   */
  to: (value: any) => {
    // Skip encryption for null/undefined values
    if (value === undefined || value === null) {
      return value;
    }

    try {
      const encryptionService = EncryptionService.getInstance(configService);
      const encrypted = encryptionService.encrypt(value);
      return encrypted;
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw error;
    }
  },
  /**
   * Transforms data after reading from database (decrypts the value).
   * 
   * @param value - The encrypted value from database
   * @returns Decrypted original value or original value if null/undefined
   */
  from: (value: any) => {
    // Skip decryption for null/undefined values
    if (value === undefined || value === null) {
      return value;
    }

    // Only attempt decryption on string values
    if (typeof value !== 'string') {
      return value;
    }

    try {
      const encryptionService = EncryptionService.getInstance(configService);
      const decrypted = encryptionService.decrypt(value);

      if (decrypted !== null) {
        return decrypted;
      } else {
        throw new Error('Decryption returned null: Possible data corruption or misconfiguration');
      }
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw error;
    }
  },
});