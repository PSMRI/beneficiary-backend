import { Injectable, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from 'src/logger/logger.service';
import { firstValueFrom } from 'rxjs';
import { ErrorResponse } from 'src/common/responses/error-response';
import * as https from 'https';
import * as crypto from 'crypto';

export interface WalletOnboardRequest {
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  username: string;
}

export interface WalletOnboardResponse {
  data: {
    token: string;
  };
}

@Injectable()
export class WalletService {
  private readonly walletBaseUrl: string;
  private readonly httpsAgent: https.Agent;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
  ) {
    this.walletBaseUrl = this.configService.get<string>('WALLET_BASE_URL');
    
    // Create HTTPS agent with proper SSL verification
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: true,
      keepAlive: true,
    });
  }

  private validateWalletData(data: WalletOnboardRequest): void {
    const requiredFields = ['firstName', 'lastName', 'phone', 'username', 'password'];
    const missingFields = requiredFields.filter(field => !data[field] || data[field].toString().trim() === '');

    if (missingFields.length > 0) {
      throw new ErrorResponse({
        statusCode: HttpStatus.BAD_REQUEST,
        errorMessage: `Missing required wallet onboard fields: ${missingFields.join(', ')}`,
      });
    }

    // Additional validation rules
    if (data.phone.length < 10) {
      throw new ErrorResponse({
        statusCode: HttpStatus.BAD_REQUEST,
        errorMessage: 'Phone number must be at least 10 digits',
      });
    }

    if (data.password.length < 4) {
      throw new ErrorResponse({
        statusCode: HttpStatus.BAD_REQUEST,
        errorMessage: 'Password must be at least 4 characters long',
      });
    }
  }

  async onboardUser(walletData: WalletOnboardRequest): Promise<WalletOnboardResponse> {
    try {
      // Validate input data
      if (!walletData) {
        throw new ErrorResponse({
          statusCode: HttpStatus.BAD_REQUEST,
          errorMessage: 'Wallet onboard data is required',
        });
      }

      this.validateWalletData(walletData);
      if (!this.walletBaseUrl) {
        throw new ErrorResponse({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          errorMessage: 'Wallet service configuration error: WALLET_BASE_URL not set',
        });
      }

      const url = `${this.walletBaseUrl}/api/wallet/onboard`;
      
      // Ensure HTTPS/HTTP is used
      if (!url.startsWith('https://') && !url.startsWith('http://')) {
        this.loggerService.warn(
          'Wallet API URL is not using HTTPS. This is a security risk.',
          'WalletService'
        );
      }

      this.loggerService.log(`Calling wallet onboard API: ${url}`, 'WalletService');
      
      // This section is intentionally sending password in the current format as per API requirements
      // Note: Password hashing should be implemented when wallet API supports it
      const response = await firstValueFrom(
        this.httpService.post<WalletOnboardResponse>(url, walletData, {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Beneficiary-Backend/1.0',
            'X-Request-ID': crypto.randomUUID(),
            'Accept': 'application/json',
            'Cache-Control': 'no-cache',
          },
          httpsAgent: this.httpsAgent,
          maxRedirects: 0, // Prevent redirect attacks
        })
      );

      this.loggerService.log('Wallet onboard API call successful', 'WalletService');
      
      return response.data;
    } catch (error) {
      this.loggerService.error(
        `Wallet onboard API call failed: ${error.message}`,
        error.stack,
        'WalletService'
      );
      
      if (error.response) {
        // API responded with error status
        throw new ErrorResponse({
          statusCode: HttpStatus.BAD_GATEWAY,
          errorMessage: `Wallet service error: ${error.response.data?.message ?? error.message}`,
        });
      } else if (error.request) {
        // Network error
        throw new ErrorResponse({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          errorMessage: 'Wallet service is unavailable',
        });
      } else {
        // Other error
        throw new ErrorResponse({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          errorMessage: `Wallet integration error: ${error.message}`,
        });
      }
    }
  }
}
