import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';

/**
 * Service for encrypting and decrypting data using AES-256-GCM algorithm.
 * Provides secure encryption with authentication to ensure data integrity.
 * 
 * Uses singleton pattern to ensure compatibility with TypeORM transformers
 * while maintaining NestJS dependency injection support.
 */
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12; // 12 bytes for AES-GCM initialization vector
  private readonly tagLength = 16; // 16 bytes for authentication tag

  private readonly encryptionKey: Buffer;
  private static instance: EncryptionService;

  constructor(private readonly configService: ConfigService) {
    const keyBase64 = this.configService.get<string>('ENCRYPTION_KEY');

    if (!keyBase64) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // Convert base64 key to Buffer (must be exactly 32 bytes for AES-256)
    this.encryptionKey = Buffer.from(keyBase64, 'base64');
    
    if (this.encryptionKey.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be a base64-encoded 32-byte key');
    }
  }

  /**
   * Gets the singleton instance of EncryptionService.
   * This method is safe to use in TypeORM transformers.
   * 
   * When called by NestJS DI, ConfigService is injected.
   * When called directly (e.g., from transformers), falls back to process.env.
   * 
   * @returns EncryptionService instance
   */
  static getInstance(configService: ConfigService): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService(configService);
    }
    return EncryptionService.instance;
  }

  /**
   * Encrypts any value and returns a base64-encoded string.
   * The value is automatically converted to JSON before encryption.
   * 
   * @param value - The data to encrypt (string, object, number, etc.)
   * @param key - Optional custom encryption key (defaults to service key)
   * @returns Base64-encoded encrypted string containing IV + auth tag + encrypted data
   */
  encrypt(value: any, key: Buffer = this.encryptionKey): string {
    // Generate random initialization vector for each encryption
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, key, iv);

    // Convert value to JSON string for consistent encryption
    let dataToEncrypt: string;
    try {
      dataToEncrypt = JSON.stringify(value);
    } catch (error) {
      throw new Error(`Failed to serialize value for encryption: ${error.message}`);
    }

    // Encrypt the data
    const encrypted = Buffer.concat([
      cipher.update(dataToEncrypt, 'utf8'), 
      cipher.final()
    ]);
    
    // Get authentication tag to verify data integrity
    const authTag = cipher.getAuthTag();

    // Combine IV + auth tag + encrypted data and encode as base64
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  /**
   * Decrypts a base64-encoded encrypted string using the service's encryption key.
   * Returns null if decryption fails instead of throwing an error.
   * 
   * @param encryptedValue - Base64-encoded encrypted string
   * @returns Decrypted and parsed original value, or null if decryption fails
   */
  decrypt(encryptedValue: string): any {
    try {
      return this.decryptWithKey(encryptedValue, this.encryptionKey);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypts a base64-encoded encrypted string using a specific key.
   * 
   * @param encryptedValue - Base64-encoded encrypted string
   * @param key - Decryption key to use
   * @returns Decrypted and parsed original value
   */
  private decryptWithKey(encryptedValue: string, key: Buffer): any {
    const buffer = Buffer.from(encryptedValue, 'base64');

    // Ensure buffer length is sufficient to extract IV, auth tag, and encrypted data
    if (buffer.length < this.ivLength + this.tagLength + 1) {
      throw new Error('Invalid encrypted data: Buffer is too short');
    }

    // Extract components: IV (12 bytes) + auth tag (16 bytes) + encrypted data
    const iv = buffer.subarray(0, this.ivLength);
    const authTag = buffer.subarray(this.ivLength, this.ivLength + this.tagLength);
    const encryptedData = buffer.subarray(this.ivLength + this.tagLength);

    // Initialize decipher and set authentication tag
    const decipher = createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the data
    const decrypted = Buffer.concat([
      decipher.update(encryptedData), 
      decipher.final()
    ]);

    // Parse JSON string back to original data type
    try {
      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      throw new Error(`Failed to parse decrypted data as JSON: ${error.message}`);
    }
  }
}