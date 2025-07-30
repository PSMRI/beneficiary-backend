#!/usr/bin/env ts-node

import 'reflect-metadata';
import { DataSource, QueryRunner } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Key Rotation Service
 * 
 * This script re-encrypts all encrypted data in the database with a new encryption key.
 * It handles three main data sources:
 * 1. user_docs.doc_data (always encrypted)
 * 2. user_applications.application_data (always encrypted)  
 * 3. field_values.value (encrypted when field.fieldAttributes->>'isEncrypted' = 'true')
 */
class KeyRotationService {
    private readonly algorithm = 'aes-256-gcm';
    private readonly ivLength = 12;
    private readonly tagLength = 16;
    
    private oldKey: Buffer;
    private newKey: Buffer;
    private dataSource: DataSource;
    private dryRun: boolean;
    
    private stats = {
        userDocs: { total: 0, processed: 0, errors: 0 },
        userApplications: { total: 0, processed: 0, errors: 0 },
        fieldValues: { total: 0, processed: 0, errors: 0 }
    };

    constructor(dryRun: boolean = false) {
        this.dryRun = dryRun;
        this.validateEnvironmentVariables();
        this.initializeKeys();
        this.initializeDataSource();
    }

    /**
     * Validates that both encryption keys are present and properly formatted
     */
    private validateEnvironmentVariables(): void {
        const oldKeyBase64 = process.env.ENCRYPTION_KEY;
        const newKeyBase64 = process.env.NEW_ENCRYPTION_KEY;

        if (!oldKeyBase64) {
            throw new Error('ENCRYPTION_KEY environment variable is required');
        }

        if (!newKeyBase64) {
            throw new Error('NEW_ENCRYPTION_KEY environment variable is required');
        }

        if (oldKeyBase64 === newKeyBase64) {
            throw new Error('NEW_ENCRYPTION_KEY must be different from current ENCRYPTION_KEY');
        }

        console.log('✓ Environment variables validated');
    }

    /**
     * Initializes encryption keys from environment variables
     */
    private initializeKeys(): void {
        try {
            this.oldKey = Buffer.from(process.env.ENCRYPTION_KEY!, 'base64');
            this.newKey = Buffer.from(process.env.NEW_ENCRYPTION_KEY!, 'base64');

            if (this.oldKey.length !== 32) {
                throw new Error('ENCRYPTION_KEY must be a base64-encoded 32-byte key');
            }

            if (this.newKey.length !== 32) {
                throw new Error('NEW_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
            }

            console.log('✓ Encryption keys initialized');
        } catch (error) {
            throw new Error(`Failed to initialize encryption keys: ${error.message}`);
        }
    }

    /**
     * Initializes TypeORM DataSource for database operations
     */
    private initializeDataSource(): void {
        this.dataSource = new DataSource({
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || 'password',
            database: process.env.DB_NAME || 'beneficiary',
            entities: [], // No entities needed for raw queries
            synchronize: false,
            logging: process.env.NODE_ENV === 'development',
        });
    }

    /**
     * Encrypts data with the new key using AES-256-GCM
     */
    private encryptWithNewKey(value: any): string {
        const iv = randomBytes(this.ivLength);
        const cipher = createCipheriv(this.algorithm, this.newKey, iv);

        let dataToEncrypt: string;
        try {
            dataToEncrypt = JSON.stringify(value);
        } catch (error) {
            throw new Error(`Failed to serialize value for encryption: ${error.message}`);
        }

        const encrypted = Buffer.concat([
            cipher.update(dataToEncrypt, 'utf8'), 
            cipher.final()
        ]);
        
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, authTag, encrypted]).toString('base64');
    }

    /**
     * Decrypts data with the old key using AES-256-GCM
     */
    private decryptWithOldKey(encryptedValue: string): any {
        const buffer = Buffer.from(encryptedValue, 'base64');

        if (buffer.length < this.ivLength + this.tagLength + 1) {
            throw new Error('Invalid encrypted data: Buffer is too short');
        }

        const iv = buffer.subarray(0, this.ivLength);
        const authTag = buffer.subarray(this.ivLength, this.ivLength + this.tagLength);
        const encryptedData = buffer.subarray(this.ivLength + this.tagLength);

        const decipher = createDecipheriv(this.algorithm, this.oldKey, iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(encryptedData), 
            decipher.final()
        ]);

        try {
            return JSON.parse(decrypted.toString('utf8'));
        } catch (error) {
            throw new Error(`Failed to parse decrypted data as JSON: ${error.message}`);
        }
    }

    /**
     * Rotates encryption keys for user_docs table
     */
    private async rotateUserDocsKeys(queryRunner: QueryRunner): Promise<void> {
        console.log('\n📋 Processing user_docs table...');
        
        // Query raw data to bypass TypeORM transformers
        const userDocs = await queryRunner.query(
            'SELECT doc_id, doc_data FROM user_docs WHERE doc_data IS NOT NULL'
        );

        this.stats.userDocs.total = userDocs.length;
        console.log(`Found ${userDocs.length} user documents to process`);

        let batchCount = 0;
        const batchSize = 100;

        for (let i = 0; i < userDocs.length; i += batchSize) {
            const batch = userDocs.slice(i, i + batchSize);
            batchCount++;
            
            console.log(`Processing batch ${batchCount}/${Math.ceil(userDocs.length / batchSize)} (${batch.length} records)`);

            for (const userDoc of batch) {
                try {
                    if (!userDoc.doc_data) continue;

                    // The data is stored encrypted, we need to decrypt with old key first
                    const decryptedData = this.decryptWithOldKey(userDoc.doc_data);
                    
                    // Re-encrypt with new key
                    const reencryptedData = this.encryptWithNewKey(decryptedData);
                    
                    if (!this.dryRun) {
                        await queryRunner.query(
                            'UPDATE user_docs SET doc_data = $1 WHERE doc_id = $2',
                            [reencryptedData, userDoc.doc_id]
                        );
                    }

                    this.stats.userDocs.processed++;
                } catch (error) {
                    console.error(`❌ Error processing user doc ${userDoc.doc_id}: ${error.message}`);
                    this.stats.userDocs.errors++;
                }
            }

            // Progress update
            const processed = Math.min(i + batchSize, userDocs.length);
            const percentage = ((processed / userDocs.length) * 100).toFixed(1);
            console.log(`Progress: ${processed}/${userDocs.length} (${percentage}%)`);
        }
    }

    /**
     * Rotates encryption keys for user_applications table
     */
    private async rotateUserApplicationsKeys(queryRunner: QueryRunner): Promise<void> {
        console.log('\n📋 Processing user_applications table...');
        
        // Query raw data to bypass TypeORM transformers
        const userApplications = await queryRunner.query(
            'SELECT internal_application_id, application_data FROM user_applications WHERE application_data IS NOT NULL'
        );

        this.stats.userApplications.total = userApplications.length;
        console.log(`Found ${userApplications.length} user applications to process`);

        let batchCount = 0;
        const batchSize = 100;

        for (let i = 0; i < userApplications.length; i += batchSize) {
            const batch = userApplications.slice(i, i + batchSize);
            batchCount++;
            
            console.log(`Processing batch ${batchCount}/${Math.ceil(userApplications.length / batchSize)} (${batch.length} records)`);

            for (const userApp of batch) {
                try {
                    if (!userApp.application_data) continue;

                    // The data is stored encrypted, we need to decrypt with old key first
                    const decryptedData = this.decryptWithOldKey(userApp.application_data);
                    
                    // Re-encrypt with new key
                    const reencryptedData = this.encryptWithNewKey(decryptedData);
                    
                    if (!this.dryRun) {
                        await queryRunner.query(
                            'UPDATE user_applications SET application_data = $1 WHERE internal_application_id = $2',
                            [reencryptedData, userApp.internal_application_id]
                        );
                    }

                    this.stats.userApplications.processed++;
                } catch (error) {
                    console.error(`❌ Error processing user application ${userApp.internal_application_id}: ${error.message}`);
                    this.stats.userApplications.errors++;
                }
            }

            // Progress update
            const processed = Math.min(i + batchSize, userApplications.length);
            const percentage = ((processed / userApplications.length) * 100).toFixed(1);
            console.log(`Progress: ${processed}/${userApplications.length} (${percentage}%)`);
        }
    }

    /**
     * Rotates encryption keys for field_values table (only encrypted fields)
     */
    private async rotateFieldValuesKeys(queryRunner: QueryRunner): Promise<void> {
        console.log('\n📋 Processing field_values table...');
        
        // Get encrypted field values by joining with fields table using raw SQL
        const encryptedFieldValues = await queryRunner.query(`
            SELECT fv.id, fv.value, fv."fieldId"
            FROM "fieldValues" fv
            INNER JOIN fields f ON f."fieldId" = fv."fieldId"
            WHERE fv.value IS NOT NULL
            AND f."fieldAttributes"->>'isEncrypted' = 'true'
        `);

        this.stats.fieldValues.total = encryptedFieldValues.length;
        console.log(`Found ${encryptedFieldValues.length} encrypted field values to process`);

        let batchCount = 0;
        const batchSize = 100;

        for (let i = 0; i < encryptedFieldValues.length; i += batchSize) {
            const batch = encryptedFieldValues.slice(i, i + batchSize);
            batchCount++;
            
            console.log(`Processing batch ${batchCount}/${Math.ceil(encryptedFieldValues.length / batchSize)} (${batch.length} records)`);

            for (const fieldValue of batch) {
                try {
                    if (!fieldValue.value) continue;

                    // The data is stored encrypted, we need to decrypt with old key first
                    const decryptedData = this.decryptWithOldKey(fieldValue.value);
                    
                    // Re-encrypt with new key
                    const reencryptedData = this.encryptWithNewKey(decryptedData);
                    
                    if (!this.dryRun) {
                        await queryRunner.query(
                            'UPDATE "fieldValues" SET value = $1 WHERE id = $2',
                            [reencryptedData, fieldValue.id]
                        );
                    }

                    this.stats.fieldValues.processed++;
                } catch (error) {
                    console.error(`❌ Error processing field value ${fieldValue.id}: ${error.message}`);
                    this.stats.fieldValues.errors++;
                }
            }

            // Progress update
            const processed = Math.min(i + batchSize, encryptedFieldValues.length);
            const percentage = ((processed / encryptedFieldValues.length) * 100).toFixed(1);
            console.log(`Progress: ${processed}/${encryptedFieldValues.length} (${percentage}%)`);
        }
    }

    /**
     * Main method to execute key rotation
     */
    async execute(): Promise<void> {
        console.log('🔄 Starting Key Rotation Process');
        console.log(`Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE EXECUTION'}`);
        console.log('=======================================\n');

        let queryRunner: QueryRunner | null = null;

        try {
            // Initialize database connection
            await this.dataSource.initialize();
            console.log('✓ Database connection established');

            queryRunner = this.dataSource.createQueryRunner();
            
            if (!this.dryRun) {
                await queryRunner.startTransaction();
                console.log('✓ Transaction started');
            }

            // Rotate keys for each table
            await this.rotateUserDocsKeys(queryRunner);
            await this.rotateUserApplicationsKeys(queryRunner);
            await this.rotateFieldValuesKeys(queryRunner);

            if (!this.dryRun) {
                await queryRunner.commitTransaction();
                console.log('✓ Transaction committed successfully');
            }

            this.printSummary();

        } catch (error) {
            console.error('💥 Key rotation failed:', error.message);
            
            if (queryRunner && !this.dryRun) {
                try {
                    await queryRunner.rollbackTransaction();
                    console.log('✓ Transaction rolled back');
                } catch (rollbackError) {
                    console.error('❌ Failed to rollback transaction:', rollbackError.message);
                }
            }
            
            throw error;
        } finally {
            if (queryRunner) {
                await queryRunner.release();
            }
            
            if (this.dataSource.isInitialized) {
                await this.dataSource.destroy();
                console.log('✓ Database connection closed');
            }
        }
    }

    /**
     * Prints execution summary
     */
    private printSummary(): void {
        console.log('\n🎯 Key Rotation Summary');
        console.log('=======================================');
        console.log(`Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE EXECUTION'}`);
        console.log('');
        
        const totalRecords = this.stats.userDocs.total + this.stats.userApplications.total + this.stats.fieldValues.total;
        const totalProcessed = this.stats.userDocs.processed + this.stats.userApplications.processed + this.stats.fieldValues.processed;
        const totalErrors = this.stats.userDocs.errors + this.stats.userApplications.errors + this.stats.fieldValues.errors;

        console.log('📊 User Documents:');
        console.log(`   Total: ${this.stats.userDocs.total}, Processed: ${this.stats.userDocs.processed}, Errors: ${this.stats.userDocs.errors}`);
        
        console.log('📊 User Applications:');
        console.log(`   Total: ${this.stats.userApplications.total}, Processed: ${this.stats.userApplications.processed}, Errors: ${this.stats.userApplications.errors}`);
        
        console.log('📊 Field Values:');
        console.log(`   Total: ${this.stats.fieldValues.total}, Processed: ${this.stats.fieldValues.processed}, Errors: ${this.stats.fieldValues.errors}`);
        
        console.log('📊 Overall:');
        console.log(`   Total: ${totalRecords}, Processed: ${totalProcessed}, Errors: ${totalErrors}`);
        
        if (totalErrors === 0) {
            console.log('');
            console.log('🎉 Key rotation completed successfully!');
            if (!this.dryRun) {
                console.log('');
                console.log('⚠️  IMPORTANT: Update your ENCRYPTION_KEY environment variable');
                console.log('   to the value of NEW_ENCRYPTION_KEY and restart your application.');
            }
        } else {
            console.log('');
            console.log(`⚠️  Key rotation completed with ${totalErrors} errors. Please review the logs above.`);
        }
    }
}

/**
 * CLI Interface
 */
async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run') || args.includes('-d');
    const help = args.includes('--help') || args.includes('-h');

    if (help) {
        console.log('Key Rotation Script');
        console.log('===================');
        console.log('');
        console.log('This script re-encrypts all encrypted data with a new encryption key.');
        console.log('');
        console.log('Usage:');
        console.log('  ts-node scripts/key-rotation.ts [options]');
        console.log('');
        console.log('Options:');
        console.log('  --dry-run, -d    Run in dry-run mode (no data will be modified)');
        console.log('  --help, -h       Show this help message');
        console.log('');
        console.log('Environment Variables:');
        console.log('  ENCRYPTION_KEY       Current encryption key (base64)');
        console.log('  NEW_ENCRYPTION_KEY   New encryption key (base64)');
        console.log('  DB_HOST             Database host (default: localhost)');
        console.log('  DB_PORT             Database port (default: 5432)');
        console.log('  DB_USERNAME         Database username (default: postgres)');
        console.log('  DB_PASSWORD         Database password (default: password)');
        console.log('  DB_NAME             Database name (default: beneficiary)');
        console.log('');
        console.log('Example:');
        console.log('  # Dry run first to test');
        console.log('  ts-node scripts/key-rotation.ts --dry-run');
        console.log('');
        console.log('  # Execute actual rotation');
        console.log('  ts-node scripts/key-rotation.ts');
        return;
    }

    try {
        const rotationService = new KeyRotationService(dryRun);
        await rotationService.execute();
        process.exit(0);
    } catch (error) {
        console.error('❌ Script failed:', error.message);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
} 