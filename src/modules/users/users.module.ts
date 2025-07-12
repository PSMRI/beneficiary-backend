import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from '@modules/users/users.controller';
import { UserService } from '@modules/users/users.service';
import { User } from '@entities/user.entity';
import { UserDoc } from '@entities/user_docs.entity';
import { EncryptionService } from 'src/common/helper/encryptionService';
import { Consent } from '@entities/consent.entity';
import { UserApplication } from '@entities/user_applications.entity';
import { KeycloakService } from '@services/keycloak/keycloak.service';
import ProfilePopulatorCron from './crons/profile-populator.cron';
import ProfilePopulator from 'src/common/helper/profileUpdate/profile-update';
import { ApplicationStatusUpdate } from './crons/application-status-update.cron';
import { ProxyService } from '@services/proxy/proxy.service';
import { CustomFieldsService } from '@modules/customfields/customfields.service';
import { Field } from '@modules/customfields/entities/field.entity';
import { FieldValue } from '@modules/customfields/entities/field-value.entity';
import { CustomFieldsModule } from '@modules/customfields/customfields.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserDoc,
      Consent,
      UserApplication,
      Field,
      FieldValue,
    ]),
    CustomFieldsModule,
  ],
  controllers: [UserController],
  providers: [
    UserService,
    EncryptionService,
    KeycloakService,
    ProfilePopulatorCron,
    ProfilePopulator,
    ApplicationStatusUpdate,
    ProxyService,
    CustomFieldsService,
  ],
   exports: [UserService],
})
export class UserModule {}
