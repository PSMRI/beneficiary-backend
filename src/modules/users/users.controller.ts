import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Version,
} from '@nestjs/common';
import { UserService } from '../users/users.service';
import { User } from '../../entity/user.entity';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Version('1')
  @Post('create')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User successfully created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.userService.create(createUserDto);
  }

  @Version('1')
  @Put('update/:userId')
  @ApiOperation({ summary: 'Update an existing user' })
  @ApiResponse({ status: 200, description: 'User successfully updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return this.userService.update(userId, updateUserDto);
  }

  @Version('1')
  @Get('get_one/:userId')
  @ApiOperation({ summary: 'Get a user by userId' })
  @ApiResponse({ status: 200, description: 'User data' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('userId') userId: string): Promise<User> {
    return this.userService.findOne(userId);
  }

  @Version('1')
  @Delete('delete/:userId')
  @ApiOperation({ summary: 'Delete a user by userId' })
  @ApiResponse({ status: 200, description: 'User successfully deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('userId') userId: string): Promise<void> {
    return this.userService.remove(userId);
  }
}
