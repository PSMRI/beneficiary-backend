import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from '@modules/users/users.controller';
import { UserService } from '@modules/users/users.service';
import { User } from '@entities/user.entity';
import { UserDoc } from '@entities/user_docs.entity';
import { UserInfo } from '@entities/user_info.entity';
import { EncryptionService } from 'src/common/helper/encryptionService';
import { Consent } from '@entities/consent.entity';
import { UserApplication } from '@entities/user_applications.entity';
import { KeycloakService } from '@services/keycloak/keycloak.service';
import ProfileValidatorCron from './crons/profile-validator.cron';
import { UserProfileValidator } from 'src/common/profile-validator/profile-validator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserDoc,
      UserInfo,
      Consent,
      UserApplication,
    ]),
  ],
  controllers: [UserController],
  providers: [
    UserService,
    EncryptionService,
    KeycloakService,
    ProfileValidatorCron,
    UserProfileValidator,
  ],
})
export class UserModule {}
