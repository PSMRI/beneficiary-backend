import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { KeycloakModule } from 'src/services/keycloak/keycloak.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { KeycloakService } from '@services/keycloak/keycloak.service';
import { UserService } from '@modules/users/users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@entities/user.entity';
import { UserDoc } from '@entities/user_docs.entity';
import { UserInfo } from '@entities/user_info.entity';
import { EncryptionService } from 'src/common/helper/encryptionService';
import { Consent } from '@entities/consent.entity';
import { UserApplication } from '@entities/user_applications.entity';
import { LoggerService } from 'src/logger/logger.service';
import ProfilePopulator from 'src/common/helper/profileUpdate/profile-update';
import { WalletService } from 'src/services/wallet/wallet.service';

@Module({
  imports: [
    HttpModule,
    KeycloakModule,
    TypeOrmModule.forFeature([
      User,
      UserDoc,
      UserInfo,
      Consent,
      UserApplication,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    ConfigService,
    KeycloakService,
    UserService,
    EncryptionService,
    LoggerService,
    ProfilePopulator,
    WalletService,
  ],
  exports: [AuthService, UserService, EncryptionService, WalletService],
})
export class AuthModule {}
