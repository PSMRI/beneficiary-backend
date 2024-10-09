import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HasuraService } from './services/hasura/hasura.service';
import { ProxyService } from './services/proxy/proxy.service';
import { LoggerService } from './logger/logger.service';
import { ContentModule } from './content/content.module';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ContentService } from './content/content.service';
import { ResponseCache } from './entity/response.entity';
import { UserModule } from './modules/users/users.module';
import { User } from './entity/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (
        configService: ConfigService,
      ): Promise<TypeOrmModuleOptions> => ({
        type: configService.get<'postgres' | 'mysql' | 'sqlite' | 'mariadb'>(
          'DB_TYPE',
        ) as 'postgres' | 'mysql' | 'sqlite' | 'mariadb',
        host: configService.get<string>('DB_HOST') as string,
        port: parseInt(configService.get<string>('DB_PORT'), 10),
        username: configService.get<string>('DB_USERNAME') as string,
        password: configService.get<string>('DB_PASSWORD') as string,
        database: configService.get<string>('DB_NAME') as string,
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
        logging: true,
      }),
    }),
    TypeOrmModule.forFeature([ResponseCache, User]),
    {
      ...HttpModule.register({}),
      global: true,
    },
    ContentModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    HasuraService,
    ProxyService,
    LoggerService,
    ContentService,
  ],
})
export class AppModule {}
