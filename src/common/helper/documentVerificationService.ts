import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
// import { issuerDid } from '../../../src/config/issuerDid';
// Adjust the path as per your project structure
import { type verr } from '@sunbird-rc/verification-sdk'; // Hypothetical Verifieer SDK import
import { UserDoc } from '@entities/user_docs.entity';
import { promises as fs } from 'fs';
// import path from 'path';
import * as path from 'path';
import { EncryptionService } from './encryptionService';

async function verify(): Promise<{ verifyCredential: Function }> {
  const module = await eval(`import('@sunbird-rc/verification-sdk')`);
  return module; // Ensure the imported module is returned
}

@Injectable()
export class DocumentVerificationService {
  constructor(
    @InjectRepository(UserDoc)
    private readonly userDocRepository: Repository<UserDoc>,
    private readonly encryptionService: EncryptionService,
  ) {}

  // @Cron(CronExpression.EVERY_5_SECONDS) // Runs every 5 minutes
  async verifyDocuments() {
    // Fetch 10 unverified documents
    const documents = await this.userDocRepository.find({
      where: { doc_verified: false },
      take: 10,
    });

    for (const doc of documents) {
      try {
        const { verifyCredential } = await verify();

        console.log('verifying doc');
        const filePath = path.join(__dirname, process.env.ISSUER_DID_FILE);
        const issuerDidContent = await fs.readFile(filePath, 'utf-8');
        const issuerDid = JSON.parse(issuerDidContent);
        console.log(issuerDid, 'issuerDid');
        let decryptedData;
        try {
          decryptedData = this.encryptionService.decrypt(doc.doc_data);
          console.log(decryptedData, 'decryptedData');
          // Call the decrypt method
        } catch (decryptionError) {
          console.error(
            `Decryption failed for document ID ${doc.doc_id}:`,
            decryptionError,
          );
          continue; // Skip to the next document if decryption fails
        }

        const result = await verifyCredential(issuerDid, doc.doc_data);
        console.log(result, 'result');
        // Update the document with verification results
        doc.doc_verified = true;
        doc.verification_result = result;
        doc.verified_at = new Date();

        await this.userDocRepository.save(doc); // Save the updated document
      } catch (error) {
        console.error(
          `Verification failed for document ID ${doc.doc_id}:`,
          error,
        );
      }
    }
  }
}
