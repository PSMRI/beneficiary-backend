import { Injectable } from '@nestjs/common';
import { readFile } from 'fs/promises';
import * as path from 'path';

@Injectable()
export class UserProfileValidator {
  private parseToStandardFormat(dateStr: string) {
    const formats = [
      { regex: /(\d{2})-(\d{2})-(\d{4})/, format: 'DD-MM-YYYY' }, // DD-MM-YYYY
      { regex: /(\d{4})-(\d{2})-(\d{2})/, format: 'YYYY-MM-DD' }, // YYYY-MM-DD
      { regex: /(\d{2})\/(\d{2})\/(\d{4})/, format: 'DD/MM/YYYY' }, // DD/MM/YYYY
      { regex: /(\d{4})\/(\d{2})\/(\d{2})/, format: 'YYYY/MM/DD' }, // YYYY/MM/DD
      // Add more formats as needed
    ];

    for (const { regex, format } of formats) {
      const match = regex.exec(dateStr);
      if (match) {
        if (format === 'DD-MM-YYYY' || format === 'DD/MM/YYYY') {
          const [, day, month, year] = match; // Use destructuring to get the groups
          return `${year}-${month}-${day}`; // Convert to 'YYYY-MM-DD'
        } else {
          return match[0]; // Already in 'YYYY-MM-DD' format
        }
      }
    }

    return null;
  }

  private getPathValue(obj: any, profileAttribute: any, vc: any) {
    let pathValue: string = obj.fields[profileAttribute];
    if (['firstName', 'middleName', 'lastName'].includes(profileAttribute)) {
      pathValue = this.getNewPathValue(vc.vcType, obj, pathValue);
    }

    return pathValue;
  }

  private getNewPathValue(vcType: string, obj: any, pathValue: any) {
    if (vcType === 'digilocker') return obj.fields['name'];
    return pathValue;
  }

  // Gets value tracing a path in a vc
  private getAttributeValue(vc: any, pathValue: string): any {
    if (vc.docFormat === 'json') {
      return pathValue
        .split('.')
        .reduce((acc, part) => acc?.[part], vc.content);
    }
  }

  private getNewAttributeValue(
    vc: any,
    attributeValue: any,
    nameFieldsPosition: any,
    profileAttribute: any,
  ) {
    if (vc.vcType === 'digilocker') {
      const nameValues: string[] = attributeValue.split(' ');
      return nameValues[nameFieldsPosition[vc.docType][profileAttribute]];
    }
    return attributeValue;
  }

  private getVC(obj: any, vcs: any, fileName: any) {
    const vc: any = vcs.find(
      (vc: any) =>
        vc.vcType === obj.vcType &&
        vc.docFormat === obj.format &&
        vc.docType === fileName,
    );

    return vc;
  }

  private async getFiles() {
    const fieldValuesPath = path.join(
      __dirname,
      '../../../src/common/profile-validator/fieldValues.json',
    );
    const nameFieldsPositionPath = path.join(
      __dirname,
      '../../../src/common/profile-validator/nameFieldsPosition.json',
    );

    let fieldValues: Record<string, Record<string, string[]>>;
    let nameFieldsPosition: Record<string, Record<string, number>>;
    try {
      fieldValues = JSON.parse(await readFile(fieldValuesPath, 'utf-8'));
      nameFieldsPosition = JSON.parse(
        await readFile(nameFieldsPositionPath, 'utf-8'),
      );
    } catch (error) {
      console.error('Error reading files:', error);
      throw error;
    }

    return { fieldValues, nameFieldsPosition };
  }

  private async getVCPathFile(fileName: any) {
    const jsonFilePath = path.join(
      __dirname,
      `../../../src/common/profile-validator/docToFieldMaps/${fileName}.json`,
    );
    const fileContent: Array<{
      vcType: string;
      format: string;
      fields: Record<string, string>;
    }> = JSON.parse(await readFile(jsonFilePath, 'utf-8'));

    return fileContent;
  }

  private checkValueForAttributes(
    profileAttribute: any,
    userProfile: any,
    attributeValue: any,
    fieldValues: any,
    vc: any,
    nameFieldsPosition: any,
  ) {
    const values: any = fieldValues[profileAttribute];
    if (values) {
      const attribute: string = userProfile[profileAttribute].toLowerCase();
      return values[attribute].includes(attributeValue.toLowerCase());
    }

    if (profileAttribute === 'dob') {
      const standardDate = this.parseToStandardFormat(attributeValue);
      if (standardDate) {
        return userProfile[profileAttribute] === standardDate;
      } else {
        return false;
      }
    }

    if (['firstName', 'middleName', 'lastName'].includes(profileAttribute)) {
      attributeValue = this.getNewAttributeValue(
        vc,
        attributeValue,
        nameFieldsPosition,
        profileAttribute,
      );

      return attributeValue == userProfile[profileAttribute];
    }

    return attributeValue == userProfile[profileAttribute];
  }

  // matches given profile attribute with values in VCs
  private async matchAttributeValue(
    fileName: string,
    profileAttribute: string,
    vcs: any,
    userProfile: any,
  ): Promise<boolean> {
    // Import required JSON files
    const { fieldValues, nameFieldsPosition } = await this.getFiles();

    if (userProfile[profileAttribute] === null) return false;

    // Import respective JSON file defining paths
    const fileContent: Array<{
      vcType: string;
      format: string;
      fields: Record<string, string>;
    }> = await this.getVCPathFile(fileName);

    // For each VC type for a document, iterate
    for (const obj of fileContent) {
      // Find VC required for current attribute
      const vc: any = this.getVC(obj, vcs, fileName);

      if (!vc) continue;

      // Get path value
      const pathValue: string = this.getPathValue(obj, profileAttribute, vc);

      // Get value of current attribute from VC
      let attributeValue: any;
      try {
        attributeValue = this.getAttributeValue(vc, pathValue);
      } catch (error) {
        attributeValue = null;
      }

      // Check if values from VC and profile match or not and return result
      const isMatch = this.checkValueForAttributes(
        profileAttribute,
        userProfile,
        attributeValue,
        fieldValues,
        vc,
        nameFieldsPosition,
      );
      if (isMatch) {
        return true;
      }
    }

    return false;
  }

  // matches each profile attribute with corresponding values from provided VCs
  async matchUserData(
    userProfileInfo: any,
    vcs: any,
  ): Promise<
    Array<{ attribute: string; verified: boolean; docsUsed: string[] }>
  > {
    const configFilePath = path.join(
      __dirname,
      '../../../src/common/profile-validator/config.json',
    );
    console.log(__dirname);
    const config: Record<string, string[]> = JSON.parse(
      await readFile(configFilePath, 'utf-8'),
    );
    const response: Array<{
      attribute: any;
      verified: boolean;
      docsUsed: string[];
    }> = [];

    for (const profileAttribute of Object.keys(userProfileInfo)) {
      let verified = false;
      const docsUsed = [];

      const files: string[] = config[profileAttribute];

      for (const fileName of files) {
        const matched: boolean = await this.matchAttributeValue(
          fileName,
          profileAttribute,
          vcs,
          userProfileInfo,
        );

        if (matched) {
          verified = true;
          docsUsed.push(fileName);
        }
      }

      response.push({
        attribute: profileAttribute,
        verified,
        docsUsed,
      });
    }

    return response;
  }
}
