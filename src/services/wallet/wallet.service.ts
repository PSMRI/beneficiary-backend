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
    
    // Create HTTPS agent with SSL verification disabled (for development only)
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false, // WARNING: This disables SSL certificate validation
    });
    
    this.loggerService.warn(
      'SSL certificate validation is disabled. This is not recommended for production.',
      'WalletService'
    );
  }

  private validateWalletData(data: WalletOnboardRequest): void {
    const requiredFields = ['firstName', 'lastName', 'phone', 'username', 'password'];
    const missingFields = requiredFields.filter(field => !data[field]);

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
      this.validateWalletData(walletData);
      if (!this.walletBaseUrl) {
        throw new ErrorResponse({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          errorMessage: 'Wallet service configuration error: WALLET_BASE_URL not set',
        });
      }

      const url = `${this.walletBaseUrl}/api/wallet/onboard`;
      
      this.loggerService.log(`Calling wallet onboard API: ${url}`, 'WalletService');
      
      // This section is intentionally sending password in the current format as per API requirements
      const response = await firstValueFrom(
        this.httpService.post<WalletOnboardResponse>(url, walletData, {
          timeout: 20000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Beneficiary-Backend/1.0',
            'X-Request-ID': crypto.randomUUID(),
          },
          httpsAgent: this.httpsAgent,
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
