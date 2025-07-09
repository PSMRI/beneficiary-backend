import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { UserController } from '@modules/users/users.controller';
import { UserService } from '@modules/users/users.service';
import { UserDoc } from '@entities/user_docs.entity';
import { EncryptionService } from 'src/common/helper/encryptionService';
import { Consent } from '@entities/consent.entity';
import { UserApplication } from '@entities/user_applications.entity';
import { KeycloakService } from '@services/keycloak/keycloak.service';
import ProfilePopulatorCron from './crons/profile-populator.cron';
import ProfilePopulator from 'src/common/helper/profileUpdate/profile-update';
import { ApplicationStatusUpdate } from './crons/application-status-update.cron';
import { ProxyService } from '@services/proxy/proxy.service';
import { UsersXref } from '@entities/users_xref.entity';
import { ExternalUserService } from './externalServices/external-user.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserDoc,
      Consent,
      UserApplication,
      UsersXref,
    ]),
    HttpModule,
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
    ExternalUserService,
  ],
   exports: [UserService],
})
export class UserModule {}
