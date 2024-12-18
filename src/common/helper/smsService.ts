import { Injectable, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ErrorResponse } from '../responses/error-response';

@Injectable()
export class SmsService {
  constructor(private readonly configService: ConfigService) {}

  async sendSms(number: string, dltTemplateId: string, message: string) {
    try {
      const customerId = this.configService.get<string>('OTP_CUSTOMER_ID');
      const entityId = this.configService.get<string>('SMS_ENTITY_ID');
      const sourceAddress = this.configService.get<string>('OTP_SOURCE_ATTR');
      const messageType = this.configService.get<string>('OTP_MESSAGE_TYPE');
      const otpAuthKey = this.configService.get<string>('OTP_AUTH_KEY');
      const apiURL = this.configService.get<string>('SMS_API_URL');

      const smsRequestData = {
        customerId,
        destinationAddress: number,
        message,
        sourceAddress,
        messageType,
        dltTemplateId,
        entityId,
        otp: false,
        metaData: {
          var: 'ABC-1234',
        },
      };

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

      await axios.request(config);
    } catch (error) {
      return new ErrorResponse({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorMessage: error.message,
      });
    }
  }
}
