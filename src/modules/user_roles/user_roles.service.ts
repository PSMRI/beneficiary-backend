// import { Injectable, NotFoundException } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { UserRole } from '@entities/user_roles.entity';
// import { CreateUserRoleDto } from './dto/create-user-role.dto';

// @Injectable()
// export class UserRolesService {
//   constructor(
//     @InjectRepository(UserRole)
//     private readonly userRolesRepository: Repository<UserRole>,
//   ) {}

//   // Create a new user_role
//   async create(createUserRoleDto: CreateUserRoleDto): Promise<UserRole> {
//     const userRole = this.userRolesRepository.create(createUserRoleDto);
//     userRole.created_at = new Date();
//     userRole.updated_at = new Date();

//     return await this.userRolesRepository.save(userRole);
//   }

//   // Update a user_role
//   async update(
//     user_id: string,
//     role_id: string,
//     updateUserRoleDto: CreateUserRoleDto,
//   ): Promise<UserRole> {
//     const userRole = await this.userRolesRepository.findOne({
//       where: { user_id: user_id, role_id: role_id },
//     });

//     if (!userRole) {
//       throw new NotFoundException('UserRole not found');
//     }

//     Object.assign(userRole, updateUserRoleDto);
//     userRole.updated_at = new Date();

//     return this.userRolesRepository.save(userRole);
//   }

//   // Get one user_role by user_id and role_id
//   async findOne(user_id: string, role_id: string): Promise<UserRole> {
//     const userRole = await this.userRolesRepository.findOne({
//       where: { user_id: user_id, role_id: role_id },
//     });

//     if (!userRole) {
//       throw new NotFoundException('UserRole not found');
//     }

//     return userRole;
//   }

//   // Get all user_roles
//   async findAll(): Promise<UserRole[]> {
//     return this.userRolesRepository.find();
//   }

//   // Delete a user_role by user_id and role_id
//   async delete(user_id: string, role_id: string): Promise<void> {
//     const result = await this.userRolesRepository.delete({
//       user_id: user_id,
//       role_id: role_id,
//     });

//     if (result.affected === 0) {
//       throw new NotFoundException('UserRole not found');
//     }
//   }
// }
