// import { User } from '@entities/user.entity';
import { UsersXref } from '@entities/users_xref.entity';
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import ProfilePopulator from 'src/common/helper/profileUpdate/profile-update';

@Injectable()
export default class ProfilePopulatorCron {
  constructor(
    // @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(UsersXref) private readonly usersXrefRepository: Repository<UsersXref>,
    private readonly profilePopulator: ProfilePopulator,
  ) {}

  // Get users from database based on conditions
  private async getUsers() {
    try {
      // Priority 0 (Highest): Users where fieldsVerified is NULL - never been verified
      // Priority 1 (Medium): Users where fieldsVerified is false but fieldsVerifiedAt exists - failed verification attempts
      // Priority 2 (Lowest): All other users (likely already verified)
      // const users = await this.userRepository
      // .createQueryBuilder('user')
      // .orderBy(
      //   `CASE
      //       WHEN user.fieldsVerified IS NULL THEN 0
      //       WHEN user.fieldsVerified = false AND user.fieldsVerifiedAt IS NOT NULL THEN 1
      //       ELSE 2
      //     END`,
      //   'ASC',
      // )
      // .addOrderBy(
      //   `CASE
      //       WHEN user.fieldsVerifiedAt IS NULL THEN "user"."updated_at"
      //       ELSE "user"."fieldsVerifiedAt"
      //     END`,
      //   'ASC',
      // )
      // .take(10)
      // .getMany();

      // return users;
    } catch (error) {
      console.error("Error fetching users: ", error);
      Logger.error("Error fetching users in 'getUsers': ", error);
      throw error;
    }
  }

  private async getUsersV2() {
    try {
      // Priority 0 (Highest): Users where fieldsVerified is NULL - never been verified
      // Priority 1 (Medium): Users where fieldsVerified is false but fieldsVerifiedAt exists - failed verification attempts
      // Priority 2 (Lowest): All other users (likely already verified)
      const userXrefs = await this.usersXrefRepository
        .createQueryBuilder('xref')
        .orderBy(
          `CASE
              WHEN xref."fieldsVerified" IS NULL THEN 0
              WHEN xref."fieldsVerified" = false AND xref."fieldsVerifiedAt" IS NOT NULL THEN 1
              ELSE 2
            END`,
          'ASC',
        )
        .addOrderBy(
          `CASE
              WHEN xref."fieldsVerifiedAt" IS NULL THEN xref."fieldsVerifiedAt"
              ELSE xref."fieldsVerifiedAt"
            END`,
          'ASC',
        )
        .take(10)
        .getMany();

      // Extract user_ids from the xref results
      const userIds = userXrefs.map(xref => xref.user_id);
      
      // Fetch the actual user objects using the user_ids
      // const users = await this.userRepository
      //   .createQueryBuilder('user')
      //   .whereInIds(userIds)
      //   .getMany();

      return userIds;
    } catch (error) {
      console.error("Error fetching users in getUsersV2: ", error);
      Logger.error("Error fetching users in 'getUsersV2': ", error);
      throw error;
    }
  }

  // @Cron('*/1 * * * *')
  // @Interval(5000) // Run every 30 seconds (30000 milliseconds)
  async populateProfile() {
    try {
      console.log("Profile Populator CRON started " + new Date());
      const users = await this.getUsersV2();
      console.log("Users: ", users);
      await this.profilePopulator.populateProfile(users);
    } catch (error) {
      console.error("Error in 'Profile Populator CRON': ", error);
      Logger.error("Error in 'Profile Populator CRON': ", error);
      throw new Error("Error in 'Profile Populator CRON': " + error);
    }
  }
}
