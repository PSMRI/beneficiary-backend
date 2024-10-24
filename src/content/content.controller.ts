import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoggerService } from 'src/logger/logger.service';
import { ContentService } from './content.service';
import { CreateOrderDto } from './dto/create-user.dto';
import { ApiBasicAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@modules/auth/auth.guard';
import { promises as fs } from 'fs';
import * as path from 'path';

@UseGuards(AuthGuard)
@ApiTags('Content')
@Controller('content')
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly logger: LoggerService,
  ) {}

  @Post('/search')
  async getContent(@Request() request, @Body() body) {
    this.logger.log('POST /search');
    return this.contentService.getJobs(body);
  }

  @Post('/responseSearch')
  async searchResponse(@Request() request, @Body() body) {
    this.logger.log('POST /responseSearch');
    return this.contentService.searchResponse(body);
  }

  @Get('/getState')
  async getState() {
    this.logger.log('GET /getState');
    return this.contentService.getState();
  }

  @Get('/getCity')
  async getCity(@Query('state') state: string) {
    this.logger.log('GET /getCity');
    return this.contentService.getCity(state);
  }

  @Get('/getTitle')
  async getTitle() {
    this.logger.log('GET /getTitle');
    return this.contentService.getTitle();
  }

  // create jobs manually
  @Post('/create')
  async contentapi() {
    this.logger.log('POST /create');
    return this.contentService.jobsApiCall();
    // return this.contentService.testApiCall()
  }

  @Post('/createOrder')
  createOrder(@Body() createOrderDto: CreateOrderDto) {
    return this.contentService.createOrder(createOrderDto);
  }

  @Get('/searchOrder/:OredrId')
  searchOrderByOrderId(@Param('OredrId') OredrId) {
    return this.contentService.searchOrderByOrderId(OredrId);
  }

  // create jobs by cronjob
  // @Cron(CronExpression.EVERY_8_HOURS)
  // async jobsApiCall() {
  //   this.logger.log('Cronjob create service executed at');
  //   return this.contentService.jobsApiCall();
  // }

  // // delete jobs by cronjob
  // @Cron(CronExpression.EVERY_DAY_AT_1AM)
  // async deleteJobs() {
  //   this.logger.log('Cronjob delete Jobs service executed at');
  //   let deletedResponse = await this.contentService.deleteJobs();
  //   if (deletedResponse) {
  //     console.log('response deleted successfully at ' + Date.now());
  //     return this.contentService.jobsApiCall();
  //   }
  // }

  // delete response cache by cronjob
  // @Cron(CronExpression.EVERY_DAY_AT_1AM)
  // async deleteResponse() {
  //     this.logger.log('Cronjob delete Response executed at')
  //     return this.contentService.deleteResponse()
  // }

  @Post('/telemetry')
  async telemetry(@Request() request, @Body() body) {
    this.logger.log('POST /telemetry', JSON.stringify(body));
    return this.contentService.addTelemetry(body);
  }

  @Post('/analytics')
  async analytics(@Request() request, @Body() body) {
    this.logger.log('POST /analytics');
    console.log('body', body);
    return this.contentService.analytics(body);
  }

  @Post('/telemetryAnalytics')
  async telemetryAnalytics(@Request() request, @Body() body) {
    this.logger.log('GET /telemetryAnalytics');
    return this.contentService.telemetryAnalytics1(body);
  }

  @Get('/documents_list')
  @ApiResponse({
    status: 200,
    description: 'List of documents',
  })
  @ApiBasicAuth('access-token')
  async getCertificates() {
    const filePath = path.join(
      __dirname,
      '../../src/common/documentMasterList.json',
    );

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const certificates = JSON.parse(data);

      return {
        success: true,
        message: 'Documents fetched successfully',
        data: certificates,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error fetching documents',
        error: error.message,
      };
    }
  }
  @Post('/encrypt')
  async encrption(@Request() request, @Body() body) {
    return this.contentService.encryption(body);
  }

  @Post('/decrypt')
  async decryption(
    @Request() request,
    @Body() body: { encryptedData: string },
  ) {
    return this.contentService.decryption(body.encryptedData);
  }
}
