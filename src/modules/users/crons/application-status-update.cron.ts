import { UserApplication } from '@entities/user_applications.entity';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { ProxyService } from '@services/proxy/proxy.service';

@Injectable()
export class ApplicationStatusUpdate {
  constructor(
    @InjectRepository(UserApplication)
    private readonly userApplicationRepository: Repository<UserApplication>,
    private readonly configService: ConfigService,
    private readonly proxyService: ProxyService,
  ) { }

  async getApplications() {
    try {
      const applications = await this.userApplicationRepository.find({
        where: {
          status: Not(In(['amount received', 'rejected', 'disbursed'])),
        },
      });

      return applications;
    } catch (error) {
      Logger.error(`Error while getting user applications: ${error}`);
      return [];
    }
  }

  async updateStatus(application: any, status: string) {
    try {
      if (!status) return;
      application.status = status.toLocaleLowerCase();

      const queryRunner =
        this.userApplicationRepository.manager.connection.createQueryRunner();
      await queryRunner.connect();
      try {
        await queryRunner.startTransaction();
        await queryRunner.manager.save(application);
        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        Logger.error(`Error in query runner: ${error}`);
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      Logger.error(`Error while updating application status: ${error}`);
    }
  }

  async getStatus(orderId: string) {
    const body = {
      context: {
        domain: 'onest:financial-support',
        action: 'status',
        timestamp: new Date().toISOString(),
        ttl: 'PT10M',
        version: '1.1.0',
        bap_id: this.configService.get<string>('BAP_ID'),
        bap_uri: this.configService.get<string>('BAP_URI'),
        bpp_id: this.configService.get<string>('BPP_ID'),
        bpp_uri: this.configService.get<string>('BPP_URI'),
        transaction_id: uuidv4(),
        message_id: uuidv4(),
      },
      message: {
        order_id: orderId,
      },
    };

    const response = await this.proxyService.bapCLientApi2('status', body);

    try {
      const status =
        response?.responses[0]?.message?.order?.fulfillments[0]?.state
          ?.descriptor?.name;

      return status;
    } catch (error) {
      console.error(`Error while getting status from response: ${error}`);
      throw new Error('Error while getting status from response');
    }
  }

  async processApplications(applications: any) {
    try {
      await Promise.all(
        applications.map(async (application: any) => {
          const status = await this.getStatus(
            application.external_application_id,
          );
          await this.updateStatus(application, status);
        }),
      );
    } catch (error) {
      Logger.error(`Error while processing applications: ${error}`);
    }
  }

  // @Cron('*/15 * * * *')
  async updateApplicationStatusCron() {
    try {
      // Get user application records from databse
      const applications = await this.getApplications();

      // Update status of each application
      await this.processApplications(applications);
    } catch (error) {
      Logger.error(`Error in 'Update user application cron': ${error}`);
    }
  }
}
