import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entity/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create(createUserDto);
    return await this.userRepository.save(user);
  }

  async update(userId: string, updateUserDto: UpdateUserDto): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: { user_id: userId },
    });
    if (!existingUser) {
      throw new NotFoundException(`User with ID '${userId}' not found`);
    }
    Object.assign(existingUser, updateUserDto);
    return await this.userRepository.save(existingUser);
  }

  async findOne(user_id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { user_id } });
    if (!user) {
      throw new NotFoundException(`User with ID '${user_id}' not found`);
    }
    return user;
  }

  async remove(user_id: string): Promise<void> {
    const user = await this.findOne(user_id);
    await this.userRepository.remove(user);
  }
}
