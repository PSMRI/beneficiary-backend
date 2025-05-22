import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AppService } from './app.service';
import { LoggerService } from './logger/logger.service';
import { ProxyService } from './services/proxy/proxy.service';
import { ContentService } from './content/content.service';
import { AuthGuard } from '@modules/auth/auth.guard';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly proxyService: ProxyService,
    private readonly logger: LoggerService,
    private readonly contentService: ContentService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('/search')
  async searchContent(@Request() request, @Body() body) {
    let endPoint = 'search';
    console.log('search method calling...', body);
    return await this.proxyService.bapCLientApi2(endPoint, body);
  }

  @Post('/select')
  async selectContent(@Request() request, @Body() body) {
    let endPoint = 'select';
    console.log('select method calling...');
    return await this.proxyService.bapCLientApi2(endPoint, body);
  }

  @Post('/init')
  @UseGuards(AuthGuard)
  async initContent(@Request() request, @Body() body) {
    let endPoint = 'init';
    console.log('init method calling...');
    return await this.proxyService.bapCLientApi2(endPoint, body);
  }

  @Post('/confirm')
  @UseGuards(AuthGuard)
  async confirmContent(@Request() request, @Body() body) {
    let endPoint = 'confirm';
    console.log('confirm method calling...');
    return await this.proxyService.bapCLientApi2(endPoint, body);
  }

  @Post('/status')
  @UseGuards(AuthGuard)
  async statusContent(@Request() request, @Body() body) {
    let endPoint = 'status';
    console.log('status method calling...');
    return await this.proxyService.bapCLientApi2(endPoint, body);
  }

  @Post('/update')
  @UseGuards(AuthGuard)
  async updateContent(@Request() request, @Body() body) {
    let endPoint = 'update';
    console.log('update method calling...');
    return await this.proxyService.bapCLientApi2(endPoint, body);
  }
}
