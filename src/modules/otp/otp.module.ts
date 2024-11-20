import { Module } from '@nestjs/common';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';
import { EncryptionService } from 'src/common/helper/encryptionService';

@Module({
  controllers: [OtpController],
  providers: [OtpService, EncryptionService],
})
export class OtpModule {}
