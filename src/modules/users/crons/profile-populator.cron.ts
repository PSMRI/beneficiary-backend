import { User } from '@entities/user.entity';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import ProfilePopulator from 'src/common/helper/profileUpdate/profile-update';

@Injectable()
export default class ProfilePopulatorCron {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly profilePopulator: ProfilePopulator,
  ) {}

  // Get users from database based on conditions
  private async getUsers() {
    try {
      const users = await this.userRepository
      .createQueryBuilder('user')
      .orderBy(
        `CASE
            WHEN user.fieldsVerified IS NULL THEN 0
            WHEN user.fieldsVerified = false AND user.fieldsVerifiedAt IS NOT NULL THEN 1
            ELSE 2
          END`,
        'ASC',
      )
      .addOrderBy(
        `CASE
            WHEN user.fieldsVerifiedAt IS NULL THEN "user"."updated_at"
            ELSE "user"."fieldsVerifiedAt"
          END`,
        'ASC',
      )
      .take(10)
      .getMany();

      return users;
    } catch (error) {
      console.error("Error fetching users: ", error);
      Logger.error("Error fetching users in 'getUsers': ", error);
      throw error;
    }
  }

  @Cron('*/5 * * * *')
  async populateProfile() {
    try {
      console.log("Profile Populator CRON started " + new Date());
      const users = await this.getUsers();
      await this.profilePopulator.populateProfile(users);
    } catch (error) {
      Logger.error("Error in 'Profile Populator CRON': ", error);
      throw new Error("Error in 'Profile Populator CRON': " + error);
    }
  }
}
