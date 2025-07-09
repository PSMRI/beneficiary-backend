import {
  Injectable,
  Logger,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import { UserServiceLoginResponse } from '@modules/auth/dto/user-service-login.response';

@Injectable()
export class ExternalUserService {
  private readonly logger = new Logger(ExternalUserService.name);
  private readonly userServiceUrl = this.configService.get<string>('USER_SERVICE_URL');
  private readonly tenantId = this.configService.get<string>('TENANT_ID');

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) { }

  async login(body: any): Promise<UserServiceLoginResponse> {
    return await axios.post(
      `${this.userServiceUrl}/user/v1/auth/login`,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }

  async getExternalUserById(userId: string, fieldvalue: string,authorization: string, ) {
    return await axios.get(`${this.userServiceUrl}/user/v1/read/${userId}${fieldvalue ? `?fieldvalue=${fieldvalue}` : ''}`, {
      headers: {
        'tenantid': this.tenantId,
        'authorization': authorization,
      },
    });
  }

  async createExternalUser(userData: any) {
    try {
      const response = await axios.post(`${this.userServiceUrl}/user/v1/create`, userData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      console.log("Error: ----------------------------", error, error?.response?.data);
      throw new InternalServerErrorException('Failed to create external user', { cause: error?.response?.data ?? error });
    }
  }

  async updateExternalUser(userId: string, updateBody: any, authorization: string) {
    try {
      const response = await axios.patch(`${this.userServiceUrl}/user/v1/update/${userId}`, updateBody, {
        headers: {
          'tenantid': this.tenantId,
          'authorization': 'Bearer ' + authorization,
        },
      });

      console.log("Update Response: ", response.data);

      return response.data;
    } catch (error) {
      console.log("Error: ----------------------------", error, error?.response?.data);
      throw new InternalServerErrorException('Failed to update external user', { cause: error?.response?.data ?? error });
    }
  }

  async getFieldList(authorization: string) {
    const response = await axios.post(`${this.userServiceUrl}/user/v1/fields/search`,
      {
        "limit": 100,
        "offset": 0,
        "filters": {
          "context": "USERS"
        }
      }
      , {
        headers: {
          'tenantid': this.tenantId,
          'authorization': 'Bearer ' + authorization,
        },
      });

    // console.log("Field List: ", response.data.result);
    return response.data.result;
  }
}
