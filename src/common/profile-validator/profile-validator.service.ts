import { Injectable } from '@nestjs/common';
import { readFile } from 'fs/promises';
import * as path from 'path';

@Injectable()
export class UserProfile {
  private parseToStandardFormat(dateStr: string) {
    const formats = [
      { regex: /(\d{2})-(\d{2})-(\d{4})/, format: 'DD-MM-YYYY' }, // DD-MM-YYYY
      { regex: /(\d{4})-(\d{2})-(\d{2})/, format: 'YYYY-MM-DD' }, // YYYY-MM-DD
      { regex: /(\d{2})\/(\d{2})\/(\d{4})/, format: 'DD/MM/YYYY' }, // DD/MM/YYYY
      { regex: /(\d{4})\/(\d{2})\/(\d{2})/, format: 'YYYY/MM/DD' }, // YYYY/MM/DD
      // Add more formats as needed
    ];

    for (const { regex, format } of formats) {
      const match = dateStr.match(regex);
      if (match) {
        if (format === 'DD-MM-YYYY' || format === 'DD/MM/YYYY') {
          const [_, day, month, year] = match;
          return `${year}-${month}-${day}`; // Convert to 'YYYY-MM-DD'
        } else {
          return match[0]; // Already in 'YYYY-MM-DD' format
        }
      }
    }

    // If no format matches, return null or handle error
    return null;
  }

  // Gets value tracing a path in a vc
  private getAttributeValue(vc: any, pathValue: string): any {
    if (vc.docFormat === 'json') {
      return pathValue.split('.').reduce((acc, part) => {
        return acc && acc[part];
      }, vc.content);
    }
  }

  // matches given profile attribute with values in VCs
  private async matchAttributeValue(
    fileName: string,
    profileAttribute: string,
    vcs: any,
    userProfile: any,
  ): Promise<boolean> {
    // Import required JSON files
    // ------------------------------------------------------------------
    const fieldValuesPath = path.join(
      __dirname,
      '../../../src/common/profile-validator/fieldValues.json',
    );
    const nameFieldsPositionPath = path.join(
      __dirname,
      '../../../src/common/profile-validator/nameFieldsPosition.json',
    );
    const fieldValues: Record<string, Record<string, string[]>> = JSON.parse(
      await readFile(fieldValuesPath, 'utf-8'),
    );
    const nameFieldsPosition: Record<
      string,
      Record<string, number>
    > = JSON.parse(await readFile(nameFieldsPositionPath, 'utf-8'));
    // -------------------------------------------------------------------

    // Import respective JSON file defining paths
    // --------------------------------------------------------------------
    const jsonFilePath = path.join(
      __dirname,
      `../../../src/common/profile-validator/docToFieldMaps/${fileName}.json`,
    );
    const fileContent: Array<{
      vcType: string;
      format: string;
      fields: Record<string, string>;
    }> = JSON.parse(await readFile(jsonFilePath, 'utf-8'));
    // --------------------------------------------------------------------

    // For each VC type for a document, iterate
    for (const obj of fileContent) {
      // console.log(`PROF ATTR: ${profileAttribute} --- FILE: ${fileName}`);
      const vcType: string = obj.vcType;
      const format: string = obj.format;

      const vc: any | undefined = vcs.find(
        (vc) =>
          vc.vcType === vcType &&
          vc.docFormat === format &&
          vc.docType === fileName,
      );

      if (vc) {
        // console.log('VC FOUND...');
        let pathValue: string = obj.fields[profileAttribute];
        if (
          ['firstName', 'middleName', 'lastName'].includes(profileAttribute)
        ) {
          if (vc.vcType === 'digilocker') {
            pathValue = obj.fields['name'];
          }
        }
        // console.log(`PATH: ${pathValue}`);

        let attributeValue: any = this.getAttributeValue(vc, pathValue);
        // console.log(`ATTR VAL: ${attributeValue}`);

        const values: any | undefined = fieldValues[profileAttribute];
        if (values) {
          const attribute: string = userProfile[profileAttribute].toLowerCase();
          return values[attribute].includes(attributeValue.toLowerCase());
        }

        if (
          ['firstName', 'middleName', 'lastName'].includes(profileAttribute)
        ) {
          if (vc.vcType === 'digilocker') {
            const nameValues: string[] = attributeValue.split(' ');
            attributeValue =
              nameValues[nameFieldsPosition[vc.docType][profileAttribute]];
          }
        }

        if (profileAttribute === 'dob') {
          const standardDate = this.parseToStandardFormat(attributeValue);
          if (standardDate) {
            const areEqual = userProfile[profileAttribute] === standardDate;
            // console.log(`Dates are equal: ${areEqual}`);
            // console.log('---------------------------------------------');
            return areEqual; // true or false based on the comparison
          } else {
            return false;
          }
        }

        // console.log(`ATTR VAL (UPDATED): ${attributeValue}`);
        // console.log(`USER PROF ATTR VAL: ${userProfile[profileAttribute]}`);
        // console.log(
        //   `VALUES MATCHED: ${attributeValue == userProfile[profileAttribute]}`,
        // );
        // console.log('---------------------------------------------');

        return attributeValue == userProfile[profileAttribute];
      }

      // console.log('VC NOT FOUND...');
      // console.log('---------------------------------------------');
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
