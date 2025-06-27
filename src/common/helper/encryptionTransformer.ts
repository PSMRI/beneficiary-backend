import { ValueTransformer } from 'typeorm';
import { EncryptionService } from './encryptionService';

const encryptionService = new EncryptionService();

export const EncryptionTransformer: ValueTransformer = {
  to: (value: any) => {
    if (value === undefined || value === null) return value;
    try {
      console.log('Encrypting value:', typeof value, value);
      const encrypted = encryptionService.encrypt(value);
      console.log('Encryption successful');
      return encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  },
  from: (value: any) => {
    if (value === undefined || value === null) return value;
    try {
      console.log('Decrypting value:', typeof value, value);
      const decrypted = encryptionService.decrypt(value);
      console.log('Decryption successful');
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw error;
    }
  },
};
