import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-ctr';
  private readonly ivLength = 16; // AES IV size (16 bytes)

  // Retrieve secret key from environment variables
  private readonly secretKey = process.env.ENCRYPTION_KEY ?? ''; // Must be 32 characters for aes-256-ctr

  constructor() {
    // Validate that the key is correctly set up
    if (this.secretKey.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
    }
  }

  // Method to encrypt any data (including objects)
  encrypt(data: any): string {
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(
      this.algorithm,
      Buffer.from(this.secretKey),
      iv,
    );

    // Convert the data to a JSON string for encryption
    const jsonData = JSON.stringify(data);

    // Encrypt the string data
    const encrypted = Buffer.concat([
      cipher.update(jsonData, 'utf8'),
      cipher.final(),
    ]);

    // Return the IV and encrypted data as a single string (iv:encrypted)
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  // Method to decrypt the encrypted string back to the original data
  // Method to decrypt the encrypted string back to the original data
  decrypt(encryptedData: any): any {
    if (typeof encryptedData !== 'string') {
      throw new Error('encryptedData must be a string');
    }

    const [ivHex, encryptedHex] = encryptedData.split(':');

    if (!ivHex || !encryptedHex) {
      throw new Error(
        'Invalid encrypted data format. Expected format is "iv:encrypted".',
      );
    }

    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = createDecipheriv(
      this.algorithm,
      Buffer.from(this.secretKey),
      iv,
    );

    // Decrypt the data
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    // Parse the decrypted data from JSON string to object
    return JSON.parse(decrypted.toString('utf8'));
  }
}
