// import { User } from '@entities/user.entity';
// import { UserDoc } from '@entities/user_docs.entity';
// import { UserInfo } from '@entities/user_info.entity';
// import { Injectable } from '@nestjs/common';
// import { Cron } from '@nestjs/schedule';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { EncryptionService } from 'src/common/helper/encryptionService';
// import { UserProfile } from 'src/common/profile-validator/profile-validator.service';

// @Injectable()
// export default class ProfileValidatorCron {
//   private userProfile: UserProfile;
//   constructor(
//     @InjectRepository(User) private readonly userRepository: Repository<User>,
//     @InjectRepository(UserDoc)
//     private readonly userDocRepository: Repository<UserDoc>,
//     @InjectRepository(UserInfo)
//     private readonly userInfoRepository: Repository<UserInfo>,
//     private readonly encryptionService: EncryptionService,
//   ) {
//     this.userProfile = new UserProfile();
//   }

//   // returns docType and vcType of a VC based on its properties from database
//   getVcMetaData(vc: any) {
//     // Define docType
//     const docType = vc.doc_subtype;

//     // Define vcType
//     const vcType = vc.imported_from === 'Digilocker' ? 'digilocker' : 'w3c';

//     // define docType

//     return { docType, vcType, docFormat: 'json' };
//   }

//   // CRON job to validate 10 user's data at a time against their VCs
//   @Cron('*/10 * * * * *')
//   async validateProfile() {
//     // Take users from User-Info Table where fields_verified_at is NULL
//     const users = await this.userInfoRepository
//       .createQueryBuilder('user')
//       .orderBy(
//         `CASE
//                 WHEN user.fields_verified_at IS NULL THEN 0
//                 WHEN user.fields_verified = false AND user.fields_verified_at IS NOT NULL THEN 1
//                 ELSE 2
//             END`,
//         'ASC',
//       )
//       .addOrderBy(
//         `CASE
//                 WHEN user.fields_verified_at IS NULL THEN "user"."updated_at"
//                 ELSE "user"."fields_verified_at"
//             END`,
//         'DESC',
//       )
//       .take(10)
//       .getMany();

//     // const users = await this.userInfoRepository.find({
//     //   where: {
//     //     user_id: '2ac3c9a2-bc8b-41f8-88fc-908a268ce984',
//     //   },
//     // });

//     // const users = [];

//     for (const user of users) {
//       // Take data available in Users table
//       const userData = await this.userRepository.findOne({
//         where: {
//           user_id: user.user_id,
//         },
//       });

//       // Get User Documents
//       const userDoc = await this.userDocRepository.find({
//         where: {
//           user_id: user.user_id,
//           verified: true,
//         },
//       });

//       // Build User Profile Info
//       const userProfileInfo = {
//         firstName: userData.first_name,
//         middleName: userData.middle_name,
//         lastName: userData.last_name,
//         gender: user.gender,
//         dob: userData.date_of_birth,
//         income: user.income,
//         caste: user.caste,
//       };

//       const vcs = [];

//       // Build VC array
//       for (const doc of userDoc) {
//         const { docType, vcType, docFormat } = this.getVcMetaData(doc);
//         const content = await JSON.parse(
//           this.encryptionService.decrypt(doc.doc_data),
//         );

//         vcs.push({ docType, vcType, docFormat, content });
//       }

//       //   console.log('VCs: ', vcs);

//       // Verify user data
//       //   const userProfile = new UserProfile(userProfileInfo, vcs);
//       const verificationResult = await this.userProfile.matchUserData(
//         userProfileInfo,
//         vcs,
//       );

//       console.log('Verification Result: ', verificationResult);

//       let cnt = 0;
//       for (const result of verificationResult) {
//         if (!result.verified) cnt++;
//       }

//       if (cnt == 0) user.fields_verified = true;
//       else user.fields_verified = false;

//       user.fields_verified_data = verificationResult;
//       user.fields_verified_at = new Date();
//       await this.userInfoRepository.save(user);
//     }
//   }
// }
