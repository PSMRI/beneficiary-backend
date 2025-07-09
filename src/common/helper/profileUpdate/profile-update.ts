import { UsersXref } from '@entities/users_xref.entity';
import { UserDoc } from '@entities/user_docs.entity';
import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncryptionService } from 'src/common/helper/encryptionService';
import { parse, format, isValid } from 'date-fns';
import { KeycloakService } from '@services/keycloak/keycloak.service';
import { IUser } from '../user-service.interfaces';
import { ExternalUserService } from 'src/modules/users/externalServices/external-user.service';
@Injectable()
export default class ProfilePopulator {
  constructor(
    @InjectRepository(UsersXref) 
    private readonly usersXrefRepository: Repository<UsersXref>,
    @InjectRepository(UserDoc)
    private readonly userDocRepository: Repository<UserDoc>,
    private readonly encryptionService: EncryptionService,
    private readonly keycloakService: KeycloakService,
    private readonly externalUserService: ExternalUserService,
  ) { }

  private formatDateToISO(inputDate: string): string | null {
    // Try native Date parsing (handles formats like "Thu, 08 May 2003 00:00:00 GMT")
    const nativeParsedDate = new Date(inputDate);
    if (isValid(nativeParsedDate)) {
      return format(nativeParsedDate, 'yyyy-MM-dd');
    }

    // Fallback to manual format parsing
    const possibleFormats = [
      'yyyy-MM-dd',
      'dd-MM-yyyy',
      'MM-dd-yyyy',
      'yyyy/MM/dd',
      'dd/MM/yyyy',
      'MM/dd/yyyy',
    ];

    for (const dateFormat of possibleFormats) {
      const parsedDate = parse(inputDate, dateFormat, new Date());
      if (isValid(parsedDate)) {
        return format(parsedDate, 'yyyy-MM-dd');
      }
    }

    return null;
  }
  
  private romanToInt(roman: string): number {
    const romanMap: { [key: string]: number } = {
      I: 1,
      V: 5,
      X: 10,
      L: 50,
      C: 100,
      D: 500,
      M: 1000,
    };

    let total = 0;

    for (let i = 0; i < roman.length; i++) {
      const current = romanMap[roman[i]];
      const next = romanMap[roman[i + 1]] || 0;

      if (current < next) {
        total -= current;
      } else {
        total += current;
      }
    }

    return total;
  }

  // Build Vcs in required format based on user documents
  async buildVCs(userDocs: any[]) {
    const vcs = [];

    // Build VC array
    for (const doc of userDocs) {
      const docType = doc.doc_subtype;
      let decryptedData: any;
      try {
        decryptedData = await this.encryptionService.decrypt(doc.doc_data);
        const content = JSON.parse(decryptedData);
        vcs.push({ docType, content });
      } catch (error) {
        const errorMessage =
          error instanceof SyntaxError
            ? `Invalid JSON format in doc ${doc.id}`
            : `Decryption failed for doc ${doc.id}`;
        Logger.error(`${errorMessage}:`, error);
        continue;
      }
    }

    return vcs;
  }

  // Get user documents from database
  private async getUserDocs(userId: any) {
    const userDocs = await this.userDocRepository.find({
      where: {
        user_id: userId,
      },
    });

    return userDocs;
  }

  // Get value from VC following a path (pathValue)
  private getValue(vc: any, pathValue: any) {
    if (!pathValue) return null;

    return pathValue.split('.').reduce((acc, part) => {
      return acc && acc[part] !== undefined ? acc[part] : null;
    }, vc.content);
  }

  // Handle name fields which are not directcly present in aadhaar vc
  private handleNameFields(vc: any, vcPaths: any, field: any) {
    const fullname = this.getValue(vc, vcPaths['name']);
    if (!fullname) return null;
    const nameParts = fullname.split(' ');
    const firstName = nameParts[0] ?? null;
    const middleName = nameParts.length === 3 ? nameParts[1] : null;
    const lastName =
      nameParts.length >= 2 ? nameParts[nameParts.length - 1] : null;

    switch (field) {
      case 'firstName':
        return firstName;
      case 'middleName':
        return middleName;
      case 'lastName':
        return lastName;
      case 'fatherName':
        return middleName;
      default:
        return null;
    }
  }

  // Handle value of gender field from aadhaar vc
  private handleGenderValue(gender: string): 'male' | 'female' | 'transgender' | null {
    if (gender === 'Male') return 'male';
    if (gender === 'Female') return 'female';
    if (gender === 'Transgender') return 'transgender';
    return null;
  }

  private handleClassField(vc: any, pathValue: any) {
    const value = this.getValue(vc, pathValue);
    if (!value) return null;
    const intValue = this.romanToInt(value);
    if (!intValue) return value;
    return intValue;
  }
  
  private handleDisabilityTypeField(vc: any, pathValue: any) {
    const value = this.getValue(vc, pathValue);
    if (!value) return null;
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_'); // Replace all other non-alphanumerics (including '-') with '_'
  }

  private extractAndEncryptField(vc: any, pathValue: any) {
    let value = this.getValue(vc, pathValue);
    if (!value) return null;

    value = this.encryptionService.encrypt(value);

    return value;
  }

  private handleDobValue(vc: any, pathValue: any) {
    const value = this.getValue(vc, pathValue);
    if (!value) return null;
    return this.formatDateToISO(value);
  }

  private handleIncomeValue(vc: any, pathValue: any): number | null {
    const value = this.getValue(vc, pathValue);

    if (value === null) return null;
    if (typeof value === 'number') {
      if (isNaN(value) || value < 0) {
        Logger.warn('Invalid income value');
        return null;
      }
      return value;
    }

    // Remove commas and spaces, then validate the format
    const sanitizedValue = value.replace(/[, ']/g, '');

    // Validate the format. If format fails it will return null
    // if (!/^\d+$/.test(sanitizedValue)) {
    //   Logger.warn(`Invalid income format: ${value}`);
    //   return null;
    // }

    // Convert to number and return
    return Number(sanitizedValue);
  }

  // For a field, get its value from given vc
  private async getFieldValueFromVC(vc: any, field: any) {
    const filePath = path.join(
      __dirname,
      `../../../../src/common/helper/profileUpdate/vcPaths/${vc.docType}.json`,
    );
    const vcPaths = JSON.parse(await readFile(filePath, 'utf-8'));

    if (!vcPaths) return null;

    // If field is aadhaar, it will need to be encrypted
    if (
      field === 'aadhaar' ||
      field === 'udid' ||
      field === 'bankAccountNumber'
    )
      return this.extractAndEncryptField(vc, vcPaths[field]);

    // If it is one of the name fields, then get values accordingly
    // if (['firstName', 'lastName', 'middleName', 'fatherName'].includes(field))
    //   return this.handleNameFields(vc, vcPaths, field);

    // If it is gender, value will be 'M' or 'F' from aadhaar, so adjust the value accordingly
    // if (field === 'gender') return this.handleGenderField(vc, vcPaths[field]);
    if (field === 'disabilityType')
      return this.handleDisabilityTypeField(vc, vcPaths[field]);
    // If it is class, value will be roman number, so convert value accordingly
    if (field === 'class') return this.handleClassField(vc, vcPaths[field]);

    // If it is dob, then adjust format as per database
    if (field === 'dob') return this.handleDobValue(vc, vcPaths[field]);

    // If it is income, need to check for commas or spaces etc.
    if (field === 'annualIncome')
      return this.handleIncomeValue(vc, vcPaths[field]);

    return this.getValue(vc, vcPaths[field]);
  }

  // Build user profile data based on array of fields and available vcs
  async buildProfile(vcs: any) {
    const userProfile = {};
    const validationData = {};
    // will come from settings
    // Get profile fields & corresponding arrays of VC names
    const profileFieldsFilePath = path.join(
      __dirname,
      '../../../../src/common/helper/profileUpdate/configFiles/vcArray.json',
    );
    const profileFields = JSON.parse(
      await readFile(profileFieldsFilePath, 'utf-8'),
    );

    for (const field in profileFields) {
      const docsUsed = [];
      const vcArray = profileFields[field];

      let value = null;
      for (const docType of vcArray) {
        const vc = vcs.find((vc: any) => vc.docType === docType);
        if (vc) {
          value = await this.getFieldValueFromVC(vc, field);
          if (value) {
            docsUsed.push(vc.docType);
            break;
          }
        }
      }

      userProfile[field] = value;
      validationData[field] = docsUsed;
    }

    return { userProfile, validationData };
  }

  // Build user data and info based on built profile
  private async buildUserDataAndInfo(profile: any, adminResultData: any) {
    console.log("Profile: ", profile);
    // see for userid
    const userData: IUser = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      middleName: profile.middleName,
      dob: profile.dob,
      gender: this.handleGenderValue(profile.gender),
      email: profile.email,
      mobile: profile.mobile, // there is no mobile in profile
    };

    // update added fields

    const fieldList = await this.externalUserService.getFieldList( adminResultData?.access_token);

    const userInfo = [];

    for (const field of fieldList) {
      if (profile[field.name] && !['firstName', 'lastName', 'middleName', 'dob', 'gender'].includes(field.name)) {
   
        userInfo.push(
          {
            name: field.name,
            fieldId: field.fieldId,
            value: profile[field.name]
          }
        )
      }
    }

    /* samagraId, currentSchoolAddress, currentSchoolDistrict,
      disabilityStatus, status, disabilityType, age, gender, motherName
      tutionAndAdminFeePaid
      */
    return { userData, userInfo };
  }

  private async handleUserUpdate(userId: string, userData: IUser, userInfo: any[], adminResultData: any) {
    const updateBody = {
      userData,
      customFields: userInfo
    }

    const user = await this.externalUserService.updateExternalUser(userId, updateBody, adminResultData?.access_token);
  }

  async updateDatabase(profile: any, validationData: any, userId: any, adminResultData: any) {
    // ===Reset user verification status===
    // Use upsert approach - find existing or create new
    let user = await this.usersXrefRepository.findOne({
      where: { user_id: userId }
    });

    if (!user) {
      user = new UsersXref();
      user.user_id = userId;
    }

    user.fieldsVerified = false;
    user.fieldsVerifiedAt = new Date();
    user.fieldsVerificationData = null;

    const queryRunner1 =
      this.usersXrefRepository.manager.connection.createQueryRunner();
    await queryRunner1.connect();
    await queryRunner1.startTransaction();
    try {
      await queryRunner1.manager.save(user);
      await queryRunner1.commitTransaction();
    } catch (error) {
      await queryRunner1.rollbackTransaction();
      Logger.error(`Error while reseting user profile: ${error}`);
    } finally {
      await queryRunner1.release();
    }
    // ===================================

    const { userData, userInfo } = await this.buildUserDataAndInfo(profile, adminResultData );

    console.log("User Data: ", userData);
    console.log("User Info: ", userInfo);

    let cnt = 0;
    for (const field in profile) {
      // if field not updated then increment the count
      if (!profile[field]) cnt++;
    }

    console.log("Count: ", cnt , "****************", profile);
    const profFilled = cnt === 0; // if all fields are updated then profFilled is true

    // user.firstName = userData.firstName ?? user.firstName;
    // user.lastName = userData.lastName ?? user.lastName;
    // user.middleName = userData.middleName;
    // user.dob = userData.dob;  

    user.fieldsVerified = profFilled;
    user.fieldsVerifiedAt = new Date();
    user.fieldsVerificationData = validationData;

    await this.handleUserUpdate(userId, userData, userInfo, adminResultData);

    const queryRunner =
      this.usersXrefRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.save(user);
      await queryRunner.commitTransaction();

      return user;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async populateProfile(users: any) {
    try {
      const adminResultData = await this.keycloakService.getAdminKeycloakToken();
      // console.log(adminResultData)
      for (const user of users) {
        try {
          // Get documents from database
          const userDocs = await this.getUserDocs(user); // uses user id
          console.log("User Docs: ", userDocs.length);
          // Build VCs in required format
          const vcs = await this.buildVCs(userDocs);
          console.log("VCS: ", vcs.length);
          // Build user-profile data - todo settings
          const { userProfile, validationData } = await this.buildProfile(vcs);
          console.log("User Profile: ", userProfile, "vdta", validationData);
          // update entries in database
          await this.updateDatabase(userProfile, validationData, user, adminResultData);
        } catch (error) {
          Logger.error(`Failed to process user ${user.user_id}:`, error);
          continue;
        }
      }
    } catch (error) {
      console.error("Error in 'Profile Populator CRON': ", error);
      Logger.error("Error in 'Profile Populator CRON': ", error);
      return error;
    }
  }
}
