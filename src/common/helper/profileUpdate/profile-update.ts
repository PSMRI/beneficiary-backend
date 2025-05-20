import { User } from '@entities/user.entity';
import { UserDoc } from '@entities/user_docs.entity';
import { UserInfo } from '@entities/user_info.entity';
import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncryptionService } from 'src/common/helper/encryptionService';
import { parse, format, isValid } from 'date-fns';
import { KeycloakService } from '@services/keycloak/keycloak.service';

@Injectable()
export default class ProfilePopulator {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(UserDoc)
    private readonly userDocRepository: Repository<UserDoc>,
    @InjectRepository(UserInfo)
    private readonly userInfoRepository: Repository<UserInfo>,
    private readonly encryptionService: EncryptionService,
    private readonly keycloakService: KeycloakService,
  ) {}

  private formatDateToISO(inputDate: string): string | null {
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

  private convertToTwoDecimalPercentage(input: string | number): string {
    if (input === '' || input === null || input === undefined) {
      return null;
    }
    if (typeof input === 'string') {
      const parsed = parseFloat(input);
      if (isNaN(parsed) || !isFinite(parsed)) {
        return null;
      }
      return parsed.toFixed(2);
    } else if (typeof input === 'number') {
      if (!Number.isFinite(input)) {
        return null;
      }
      return input.toFixed(2);
    } else {
      return null;
    }
  }

  // Build Vcs in required format based on user documents
  async buildVCs(userDocs: any) {
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
  private async getUserDocs(user: any) {
    const userDocs = await this.userDocRepository.find({
      where: {
        user_id: user.user_id,
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
    const firstName = nameParts[0] || null;
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
  private handleGenderField(vc: any, pathValue: any) {
    const value = this.getValue(vc, pathValue);

    switch (value) {
      case 'M':
      case 'Male':
        return 'male';
      case 'F':
      case 'Female':
        return 'female';
      default:
        return null;
    }
  }

  private handleClassField(vc: any, pathValue: any) {
    const value = this.getValue(vc, pathValue);
    if (!value) return null;
    const intValue = this.romanToInt(value);
    if (!intValue) return value;
    return intValue;
  }

  private handleAadhaarValue(vc: any, pathValue: any) {
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

  private handleMarksValue(vc: any, pathValue: any): string | null {
    let value = this.getValue(vc, pathValue);
    if (!value) return null;

    value = this.convertToTwoDecimalPercentage(value);
    return value;
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
    if (field === 'aadhaar') return this.handleAadhaarValue(vc, vcPaths[field]);

    // If it is one of the name fields, then get values accordingly
    if (['firstName', 'lastName', 'middleName', 'fatherName'].includes(field))
      return this.handleNameFields(vc, vcPaths, field);

    // If it is gender, value will be 'M' or 'F' from aadhaar, so adjust the value accordingly
    if (field === 'gender') return this.handleGenderField(vc, vcPaths[field]);

    // If it is class, value will be roman number, so convert value accordingly
    if (field === 'class') return this.handleClassField(vc, vcPaths[field]);

    // If it is dob, then adjust format as per database
    if (field === 'dob') return this.handleDobValue(vc, vcPaths[field]);

    // If it is income, need to check for commas or spaces etc.
    if (field === 'annualIncome')
      return this.handleIncomeValue(vc, vcPaths[field]);

    if (field === 'previousYearMarks')
      return this.handleMarksValue(vc, vcPaths[field]);

    return this.getValue(vc, vcPaths[field]);
  }

  // Build user profile data based on array of fields and available vcs
  async buildProfile(vcs: any) {
    const userProfile = {};
    const validationData = {};

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
  private buildUserDataAndInfo(profile: any) {
    const userData = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      middleName: profile.middleName,
      dob: profile.dob,
    };

    const userInfo = {
      fatherName: profile.fatherName,
      gender: profile.gender,
      caste: profile.caste,
      aadhaar: profile.aadhaar,
      annualIncome: profile.annualIncome ? Number(profile.annualIncome) : null,
      class: profile.class ? Number(profile.class) : null,
      studentType: profile.studentType,
      previousYearMarks: profile.previousYearMarks,
      dob: profile.dob,
      state: profile.state,
    };

    return { userData, userInfo };
  }

  // Handle rows from 'user_info' table in database
  private async handleUserInfo(user: any, userInfo: any) {
    const queryRunner =
      this.userInfoRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const userRows = await queryRunner.manager.find(UserInfo, {
        where: {
          user_id: user.user_id,
        },
      });

      let row: UserInfo;

      if (userRows.length === 0) {
        row = this.userInfoRepository.create({
          user_id: user.user_id,
          fatherName: userInfo.fatherName,
          gender: userInfo.gender,
          caste: userInfo.caste,
          annualIncome: userInfo.annualIncome,
          class: userInfo.class,
          aadhaar: userInfo.aadhaar,
          studentType: userInfo.studentType,
          previousYearMarks: userInfo.previousYearMarks,
          dob: userInfo.dob,
          state: userInfo.state,
        });
      } else {
        row = userRows[0];
        row.fatherName = userInfo.fatherName;
        row.gender = userInfo.gender;
        row.caste = userInfo.caste;
        row.annualIncome = userInfo.annualIncome;
        row.class = userInfo.class;
        row.aadhaar = userInfo.aadhaar;
        row.studentType = userInfo.studentType;
        row.previousYearMarks = userInfo.previousYearMarks;
        row.dob = userInfo.dob;
        row.state = userInfo.state;
      }

      await queryRunner.manager.save(row);
      await queryRunner.commitTransaction();
      return row;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Update values in database based on built profile
  async updateDatabase(profile: any, validationData: any, user: any) {
    // ===Reset user verification status===
    user.fieldsVerified = false;
    user.fieldsVerifiedAt = new Date();
    user.fieldsVerificationData = null;

    const queryRunner1 =
      this.userRepository.manager.connection.createQueryRunner();
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

    const { userData, userInfo } = this.buildUserDataAndInfo(profile);

    let cnt = 0;
    for (const field in profile) {
      if (!profile[field]) cnt++;
    }
    const profFilled = cnt === 0;

    user.firstName = userData.firstName ? userData.firstName : user.firstName;
    user.lastName = userData.lastName ? userData.lastName : user.lastName;
    user.middleName = userData.middleName;
    user.dob = userData.dob;
    user.fieldsVerified = profFilled;
    user.fieldsVerifiedAt = new Date();
    user.fieldsVerificationData = validationData;

    await this.handleUserInfo(user, userInfo);

    const queryRunner =
      this.userRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.save(user);
      await queryRunner.commitTransaction();

      // Update firstName & lastName in keycloak as well
      try {
        await this.keycloakService.updateUser(user.sso_id, {
          firstName: profile.firstName,
          lastName: profile.lastName,
        });
      } catch (keycloakError) {
        Logger.error('Failed to update user in Keycloak: ', keycloakError);
      }
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
      for (const user of users) {
        try {
          // Get documents from database
          const userDocs = await this.getUserDocs(user);

          // Build VCs in required format
          const vcs = await this.buildVCs(userDocs);

          // Build user-profile data
          const { userProfile, validationData } = await this.buildProfile(vcs);

          // update entries in database
          await this.updateDatabase(userProfile, validationData, user);
        } catch (error) {
          Logger.error(`Failed to process user ${user.user_id}:`, error);
          continue;
        }
      }
    } catch (error) {
      Logger.error("Error in 'Profile Populator CRON': ", error);
      return error;
    }
  }
}
