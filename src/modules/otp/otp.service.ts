import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorResponse } from 'src/common/responses/error-response';
import { SuccessResponse } from 'src/common/responses/success-response';
import * as crypto from 'crypto';
import { EncryptionService } from 'src/common/helper/encryptionService';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class OtpService {
  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
  ) {}
  private validateIndianPhoneNumber(phoneNumber: string): boolean {
    // Regular expression to match the Indian phone number format
    const phoneRegex = /^\+91-\d{10}$/;

    // Check if the phone number matches the regex
    if (phoneRegex.test(phoneNumber)) {
      // Extract the 10-digit number
      const numberPart = phoneNumber.split('-')[1];

      // Check if the first digit of the number is between 7 and 9
      const firstDigit = parseInt(numberPart.charAt(0), 10);
      if (firstDigit >= 6 && firstDigit <= 9) {
        return true; // Valid Indian phone number
      }
    }

    return false; // Invalid phone number
  }

  private generateOTP() {
    const otp = crypto.randomInt(100000, 999999);
    return otp;
  }

  public async sendOTP(number: any) {
    try {
      // Validate Phone Number
      const { phoneNumber } = number;
      if (!this.validateIndianPhoneNumber(phoneNumber)) {
        return new ErrorResponse({
          statusCode: HttpStatus.BAD_REQUEST,
          errorMessage: 'Invalid Phone Number',
        });
      }

      // Generate OTP with expiry
      const otp = this.generateOTP();
      const expiry = Date.now() + 1000 * 60 * 5;

      // Generate HASH
      const data = `${phoneNumber}.${otp}`;
      const hash = crypto.createHash('sha256').update(data).digest('hex');

      // Generate encrypted token of hash & expiry
      const token = this.encryptionService.encrypt(
        JSON.stringify({ hash, expiry }),
      );

      // Call API to send SMS
      const customerId = this.configService.get<string>('OTP_CUSTOMER_ID');
      const dltTemplateId = this.configService.get<string>('OTP_TEMPLATE_ID');
      const entityId = this.configService.get<string>('OTP_ENTITY_ID');
      const sourceAddress = this.configService.get<string>('OTP_SOURCE_ATTR');
      const messageType = this.configService.get<string>('OTP_MESSAGE_TYPE');
      const smsRequestData = JSON.stringify({
        customerId: customerId,
        destinationAddress: phoneNumber.split('-')[1],
        message: `Dear Citizen, your OTP for login is ${otp}. Use it within 5 minutes. Do not share this code. Regards PSMRIAM.`,
        sourceAddress: sourceAddress,
        messageType: messageType,
        dltTemplateId: dltTemplateId,
        entityId: entityId,
        otp: true,
        metaData: {
          var: 'ABC-1234',
        },
      });

      const otpAuthKey = this.configService.get<string>('OTP_AUTH_KEY');
      const apiURL = this.configService.get<string>('SMS_API_URL');
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: apiURL,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Basic ${otpAuthKey}`,
        },
        data: smsRequestData,
      };

      const smsResponse = await axios.request(config);

      if (smsResponse.status !== 200) {
        console.error('Error sending SMS:', smsResponse.data);
        return new ErrorResponse({
          statusCode: smsResponse.status,
          errorMessage: 'Error sending SMS',
        });
      }

      // Send API Response
      return new SuccessResponse({
        statusCode: HttpStatus.OK,
        message: `OTP Sent Successfully`,
        data: { token },
      });
    } catch (error) {
      console.log(`Error in 'Send OTP': ${error}`);
      return new ErrorResponse({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorMessage: error.message,
      });
    }
  }

  public async verifyOTP(otpBody: any) {
    try {
      const { phoneNumber, otp, token } = otpBody;

      // Decode token
      const tokenContent = JSON.parse(this.encryptionService.decrypt(token));

      // Create a hash
      const data = `${phoneNumber}.${otp}`;
      const newhash = crypto.createHash('sha256').update(data).digest('hex');

      // Compare hashes
      if (tokenContent.hash !== newhash) {
        return new ErrorResponse({
          statusCode: HttpStatus.BAD_REQUEST,
          errorMessage: 'Invalid OTP',
        });
      }

      // Compare expiry
      if (Date.now() > tokenContent.expiry) {
        return new ErrorResponse({
          statusCode: HttpStatus.BAD_REQUEST,
          errorMessage: 'OTP Expired. Try Agan',
        });
      }
      return new SuccessResponse({
        statusCode: HttpStatus.OK,
        message: `OTP Verified Successfully`,
      });
    } catch (error) {
      console.log(`Error in 'Verify OTP': ${error}`);
      return new ErrorResponse({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorMessage: error.message,
      });
    }
  }
}
