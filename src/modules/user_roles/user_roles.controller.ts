// import {
//   Controller,
//   Get,
//   Patch,
//   Delete,
//   Query,
//   Body,
//   Post,
//   UseGuards,
// } from '@nestjs/common';
// import { UserRolesService } from './user_roles.service';
// import { UserRole } from '@entities/user_roles.entity';
// import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
// import { CreateUserRoleDto } from './dto/create-user-role.dto';
// import { AuthGuard } from '@modules/auth/auth.guard';

// @UseGuards(AuthGuard)
// @ApiTags('User Roles')
// @Controller('user_roles')
// export class UserRolesController {
//   constructor(private readonly userRolesService: UserRolesService) {}

//   // Create a new user_role
//   @Post('create')
//   @ApiOperation({ summary: 'Create a new user role' })
//   @ApiResponse({ status: 201, description: 'User role successfully created' })
//   @ApiResponse({ status: 400, description: 'Bad Request' })
//   async create(
//     @Body() createUserRoleDto: CreateUserRoleDto,
//   ): Promise<UserRole> {
//     return this.userRolesService.create(createUserRoleDto);
//   }

//   @Patch('update')
//   @ApiQuery({ name: 'user_id', required: true, type: String })
//   @ApiQuery({ name: 'role_id', required: true, type: String })
//   @ApiOperation({ summary: 'Update a user role' })
//   @ApiResponse({ status: 200, description: 'User role successfully updated' })
//   @ApiResponse({ status: 404, description: 'User role not found' })
//   async update(
//     @Query('user_id') user_id: string,
//     @Query('role_id') role_id: string,
//     @Body() updateUserRoleDto: CreateUserRoleDto,
//   ): Promise<UserRole> {
//     return this.userRolesService.update(user_id, role_id, updateUserRoleDto);
//   }

//   @Get('get_one')
//   @ApiQuery({ name: 'user_id', required: true, type: String })
//   @ApiQuery({ name: 'role_id', required: true, type: String })
//   @ApiOperation({ summary: 'Get a user role by user_id and role_id' })
//   @ApiResponse({ status: 200, description: 'User role data' })
//   @ApiResponse({ status: 404, description: 'User role not found' })
//   async getOne(
//     @Query('user_id') user_id: string,
//     @Query('role_id') role_id: string,
//   ): Promise<UserRole> {
//     return this.userRolesService.findOne(user_id, role_id);
//   }

//   @Get('get_all')
//   @ApiOperation({ summary: 'Get all user roles' })
//   @ApiResponse({ status: 200, description: 'List of all user roles' })
//   async getAll(): Promise<UserRole[]> {
//     return this.userRolesService.findAll();
//   }

//   @Delete('delete')
//   @ApiQuery({ name: 'user_id', required: true, type: String })
//   @ApiQuery({ name: 'role_id', required: true, type: String })
//   @ApiOperation({ summary: 'Delete a user role by user_id and role_id' })
//   @ApiResponse({ status: 200, description: 'User role successfully deleted' })
//   @ApiResponse({ status: 404, description: 'User role not found' })
//   async delete(
//     @Query('user_id') user_id: string,
//     @Query('role_id') role_id: string,
//   ): Promise<void> {
//     return this.userRolesService.delete(user_id, role_id);
//   }
// }
