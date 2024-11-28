import { User } from '@entities/user.entity';
import { UserDoc } from '@entities/user_docs.entity';
import { UserInfo } from '@entities/user_info.entity';
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncryptionService } from 'src/common/helper/encryptionService';
import { UserProfileValidator } from 'src/common/profile-validator/profile-validator.service';

@Injectable()
export default class ProfileValidatorCron {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(UserDoc)
    private readonly userDocRepository: Repository<UserDoc>,
    @InjectRepository(UserInfo)
    private readonly userInfoRepository: Repository<UserInfo>,
    private readonly encryptionService: EncryptionService,
    private readonly userProfileValidator: UserProfileValidator,
  ) {}

  // returns docType and vcType of a VC based on its properties from database
  private getVcMetaData(vc: any) {
    // Define docType
    const docType = vc.doc_subtype;

    // Define vcType
    const vcType = vc.imported_from === 'Digilocker' ? 'digilocker' : 'w3c';

    // define docType

    return { docType, vcType, docFormat: 'json' };
  }

  private buildUserData(userData: any, user: any) {
    const userProfileInfo = {
      firstName: userData.first_name ? userData.first_name : null,
      middleName: userData.middle_name ? userData.middle_name : null,
      lastName: userData.last_name ? userData.last_name : null,
      gender: user.gender ? user.gender : null,
      dob: userData.date_of_birth ? userData.date_of_birth : null,
      income: user.income ? user.income : null,
      caste: user.caste ? user.caste : null,
    };

    return userProfileInfo;
  }

  private async buildVCs(userDocs: any) {
    const vcs = [];

    // Build VC array
    for (const doc of userDocs) {
      const { docType, vcType, docFormat } = this.getVcMetaData(doc);
      const content = await JSON.parse(
        this.encryptionService.decrypt(doc.doc_data),
      );

      vcs.push({ docType, vcType, docFormat, content });
    }

    return vcs;
  }

  private async getUserInfo() {
    const users = await this.userInfoRepository
      .createQueryBuilder('user')
      .orderBy(
        `CASE
                  WHEN user.fields_verified_at IS NULL THEN 0
                  WHEN user.fields_verified = false AND user.fields_verified_at IS NOT NULL THEN 1
                  ELSE 2
              END`,
        'ASC',
      )
      .addOrderBy(
        `CASE
                  WHEN user.fields_verified_at IS NULL THEN "user"."updated_at"
                  ELSE "user"."fields_verified_at"
              END`,
        'DESC',
      )
      .take(10)
      .getMany();

    return users;
  }

  private async getUserDataAndDocs(user: any) {
    const userData = await this.userRepository.findOne({
      where: {
        user_id: user.user_id,
      },
    });

    const userDocs = await this.userDocRepository.find({
      where: {
        user_id: user.user_id,
        verification_result: true,
      },
    });

    return { userData, userDocs };
  }

  // CRON job to validate 10 user's data at a time against their VCs
  @Cron('*/5 * * * *')
  async validateProfile() {
    // Take users from User-Info Table where fields_verified_at is NULL
    try {
      const users = await this.getUserInfo();

      for (const user of users) {
        // Take data available in Users table and documents from user_docs
        const { userData, userDocs } = await this.getUserDataAndDocs(user);

        // Build User Profile Info
        const userProfileInfo = this.buildUserData(userData, user);

        const vcs = await this.buildVCs(userDocs);

        //   console.log('VCs: ', vcs);

        // Verify user data
        const verificationResult =
          await this.userProfileValidator.matchUserData(userProfileInfo, vcs);

        // console.log('Verification Result: ', verificationResult);

        // Update user info
        let cnt = 0;
        for (const result of verificationResult) {
          if (!result.verified) cnt++;
        }

        if (cnt == 0) user.fields_verified = true;
        else user.fields_verified = false;

        user.fields_verified_data = verificationResult;
        user.fields_verified_at = new Date();
        await this.userInfoRepository.save(user);
      }
    } catch (error) {
      console.log("Error in 'Profile Validator CRON': ", error);
    }
  }
}
