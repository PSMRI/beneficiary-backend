import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserService } from '../users/users.service';
import {
  ApiBasicAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUserDocDTO } from './dto/user_docs.dto';
import { CreateUserInfoDto } from './dto/create-user-info.dto';
import { CreateConsentDto } from './dto/create-consent.dto';
import { UserApplication } from '@entities/user_applications.entity';
import { CreateUserApplicationDto } from './dto/create-user-application-dto';
import { AuthGuard } from '@modules/auth/auth.guard';
import { Request } from 'express';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('/create')
  @ApiBasicAuth('access-token')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User successfully created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @UseGuards(AuthGuard)
  @Put('/update/:userId')
  @ApiBasicAuth('access-token')
  @ApiOperation({ summary: 'Update an existing user' })
  @ApiResponse({ status: 200, description: 'User successfully updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() updateUserDto: any,
  ) {
    return this.userService.update(userId, updateUserDto);
  }

  @UseGuards(AuthGuard)
  @Get('/get_one')
  @ApiBasicAuth('access-token')
  @ApiResponse({ status: 200, description: 'User data' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiQuery({
    name: 'decryptData',
    required: false,
    description: 'Whether to decrypt user data (optional)',
    type: Boolean,
  })
  async findOne(
    @Req() req: Request,
    @Query('decryptData') decryptData?: boolean,
  ) {
    return await this.userService.findOne(req, decryptData);
  }

  @UseGuards(AuthGuard)
  @Get('/get_my_consents')
  @ApiBasicAuth('access-token')
  @ApiResponse({ status: 200, description: 'Consent data' })
  @ApiResponse({ status: 404, description: 'Consent not found' })
  @ApiQuery({
    name: 'decryptData',
    required: false,
    description: 'Whether to decrypt user data (optional)',
    type: Boolean,
  })
  async findConsentByUser(@Req() req: Request) {
    return await this.userService.findConsentByUser(req);
  }

  @UseGuards(AuthGuard)
  @Post('/user_docs')
  @ApiBasicAuth('access-token')
  @ApiOperation({ summary: 'Save user docs' })
  @ApiResponse({ status: 200, description: 'User docs saved successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async createUserDoc(@Body() createUserDocDto: CreateUserDocDTO) {
    return this.userService.createUserDoc(createUserDocDto);
  }

  @UseGuards(AuthGuard)
  @Post('/wallet/user_docs')
  @ApiBasicAuth('access-token')
  @ApiOperation({ summary: 'Save user docs' })
  @ApiResponse({ status: 200, description: 'User docs saved successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async createUserDocs(
    @Req() req: Request,
    @Body() createUserDocDto: CreateUserDocDTO[],
  ) {
    return this.userService.createUserDocsNew(req, createUserDocDto);
  }

  @UseGuards(AuthGuard)
  @Post('/user_info')
  @ApiBasicAuth('access-token')
  async createUSerInfo(@Body() createUserInfoDto: CreateUserInfoDto) {
    return await this.userService.createUserInfo(createUserInfoDto);
  }

  @UseGuards(AuthGuard)
  @Put('/user_info/:user_id')
  @ApiBasicAuth('access-token')
  async updateUserInfo(
    @Param('user_id') user_id: string,
    @Body() updateUserInfoDto: CreateUserInfoDto,
  ) {
    return await this.userService.updateUserInfo(user_id, updateUserInfoDto);
  }

  @UseGuards(AuthGuard)
  @Post('/consent')
  @ApiBasicAuth('access-token')
  async createUserConsent(@Body() createConsentDto: CreateConsentDto) {
    return this.userService.createUserConsent(createConsentDto);
  }

  @UseGuards(AuthGuard)
  @Post('/user_application')
  @ApiBasicAuth('access-token')
  @ApiOperation({ summary: 'Create a new user application' })
  @ApiResponse({
    status: 201,
    description: 'User application created successfully',
    type: UserApplication,
  })
  async createUserApplication(
    @Body() createUserApplicationDto: CreateUserApplicationDto,
  ) {
    return this.userService.createUserApplication(createUserApplicationDto);
  }

  @UseGuards(AuthGuard)
  @Get('/user_application/:internal_application_id')
  @ApiBasicAuth('access-token')
  @ApiOperation({ summary: 'Get user application by ID' })
  @ApiResponse({
    status: 200,
    description: 'User application data',
    type: UserApplication,
  })
  @ApiResponse({ status: 404, description: 'User application not found' })
  async findOneUserApplication(
    @Param('internal_application_id') internal_application_id: string,
  ) {
    return this.userService.findOneUserApplication(internal_application_id);
  }

  @UseGuards(AuthGuard)
  @Post('/user_applications_list')
  @ApiBasicAuth('access-token')
  @ApiOperation({ summary: 'Get all applications for a specific user' })
  @ApiResponse({
    status: 200,
    description: 'List of user applications',
    type: [UserApplication],
  })
  async findAllApplicationsByUserId(
    @Body() requestBody: { filters: any; search: string },
  ) {
    return this.userService.findAllApplicationsByUserId(requestBody);
  }
}
