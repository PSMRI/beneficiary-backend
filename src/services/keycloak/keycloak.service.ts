import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosRequestConfig } from 'axios';
import { lastValueFrom, map } from 'rxjs';

@Injectable()
export class KeycloakService {
  public keycloak_url = this.configService.get<string>('KEYCLOAK_URL');
  public keycloak_admin_cli_client_secret = this.configService.get<string>(
    'KEYCLOAK_ADMIN_CLI_CLIENT_SECRET',
  );
  public realm_name_app = this.configService.get<string>(
    'KEYCLOAK_REALM_NAME_APP',
  );
  public client_name_app = this.configService.get<string>(
    'KEYCLOAK_CLIENT_NAME_APP',
  );

  constructor(
    private configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  public async getAdminKeycloakToken() {
    const url = `${this.keycloak_url}/realms/master/protocol/openid-connect/token`;

    let payload = {
      username: 'admin',
      client_id: 'admin-cli',
      grant_type: 'client_credentials',
      // password: process.env.KEYCLOAK_ADMIN_PASSWORD,
      client_secret: process.env.KEYCLOAK_ADMIN_CLI_CLIENT_SECRET,
    };

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    try {
      const observable = this.httpService.post(url, payload, config);
      const promise = observable.toPromise();
      const response = await promise;

      return response.data;
    } catch (e) {
      console.log('getAdminKeycloakToken', e.message);
    }
  }

  public async getUserKeycloakToken(data) {
    const url = `${this.keycloak_url}/realms/${this.realm_name_app}/protocol/openid-connect/token`;

    let payload = {
      client_id: this.client_name_app,
      grant_type: 'password',
      username: data.username,
      password: data.password,
    };

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    try {
      const observable = this.httpService.post(url, payload, config);
      const promise = observable.toPromise();
      const response = await promise;

      return response.data;
    } catch (e) {
      console.log('getUserKeycloakToken', e.message);
    }
  }

  public async resetPassword(keycloak_id, token, password) {
    console.log('resetPassword');
    const data = {
      temporary: false,
      type: 'password',
      value: password,
    };

    const url = `${this.keycloak_url}/admin/realms/${this.realm_name_app}/users/${keycloak_id}/reset-password`;

    const config: AxiosRequestConfig = {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    try {
      const observable = this.httpService.put(url, data, config);
      const promise = observable.toPromise();
      const response = await promise;
      console.log('password updated');

      if (response.status === 204) {
        return true;
      } else {
        return false;
      }
    } catch (e) {
      console.log('resetPassword', e.message);
      return false;
    }
  }

  public async getUserByUsername(username): Promise<{ [key: string]: any }> {
    try {
      const adminResultData = await this.getAdminKeycloakToken();

      if (adminResultData?.access_token) {
        let url = `${this.configService.get<string>(
          'KEYCLOAK_URL',
        )}/admin/realms/${this.realm_name_app}/users`;

        const {
          headers,
          status,
          data: [user],
        } = await lastValueFrom(
          this.httpService
            .get(url, {
              params: { username, exact: true },
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminResultData.access_token}`,
              },
            })
            .pipe(map((res) => res)),
        );
        if (!user) {
          return { isUserExist: false, user: null };
        }
        return {
          headers,
          status,
          user,
        };
      } else {
        throw new BadRequestException('User not found in keycloak !');
      }
    } catch (e) {
      console.log('error 105' + e.message);
      throw new HttpException(e.message, HttpStatus.CONFLICT, {
        cause: e,
      });
    }
  }

  public async createUser(userData): Promise<{ [key: string]: any }> {
    try {
      const adminResultData = await this.getAdminKeycloakToken();

      if (adminResultData?.access_token) {
        let url = `${this.configService.get<string>(
          'KEYCLOAK_URL',
        )}/admin/realms/${this.realm_name_app}/users`;
        let data = userData;

        const { headers, status } = await lastValueFrom(
          this.httpService
            .post(url, data, {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminResultData.access_token}`,
              },
            })
            .pipe(map((res) => res)),
        );
        return {
          headers,
          status,
        };
      } else {
        throw new BadRequestException('Error while creating user !');
      }
    } catch (e) {
      console.log('error 105' + e.message);
      throw new HttpException(e.message, HttpStatus.CONFLICT, {
        cause: e,
      });
    }
  }
  public async deleteUser(userId: string): Promise<{ [key: string]: any }> {
    try {
      // Get Keycloak admin access token
      const adminResultData = await this.getAdminKeycloakToken();

      if (adminResultData?.access_token) {
        // Keycloak URL to delete user
        const url = `${this.configService.get<string>(
          'KEYCLOAK_URL',
        )}/admin/realms/${this.realm_name_app}/users/${userId}`;

        // Make HTTP DELETE request to delete the user
        const { status, data } = await lastValueFrom(
          this.httpService
            .delete(url, {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminResultData.access_token}`,
              },
            })
            .pipe(map((res) => res)),
        );

        return {
          status,
          data,
        };
      } else {
        throw new BadRequestException('Error while deleting user!');
      }
    } catch (e) {
      console.log('Error deleting user: ' + e.message);
      throw new HttpException(e.message, HttpStatus.CONFLICT, {
        cause: e,
      });
    }
  }

  public async registerUser(data, token) {
    console.log('inside registerUser', data);

    const url = `${this.keycloak_url}/admin/realms/${this.realm_name_app}/users`;

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };

    let registerUserRes: any;
    try {
      const observable = this.httpService.post(url, data, config);

      const promise = observable.toPromise();

      const { headers, status } = await promise;
      console.log('registerUser response', headers);
      registerUserRes = {
        headers,
        status,
      };
    } catch (err) {
      console.log('registerUser err', err);
      registerUserRes = { error: err };
    }
    return registerUserRes;
  }

  public async findUser(data, token) {
    console.log('inside findUser', data);

    const url = `${this.keycloak_url}/admin/realms/${this.realm_name_app}/users?username=${data}`;

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };

    let registerUserRes: any;
    try {
      const observable = this.httpService.get(url, config);
      const promise = observable.toPromise();
      const response = await promise;
      console.log('response 171', response.data);
      return response.data;
    } catch (err) {
      console.log('findUser err', err);
      registerUserRes = { error: err };
    }
    return registerUserRes;
  }

  public async findUserByKeycloakId(keycloak_id) {
    const token = await this.getAdminKeycloakToken();
    const url = `${this.keycloak_url}/admin/realms/${this.realm_name_app}/users/${keycloak_id}`;
    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token?.access_token}`,
      },
    };

    let registerUserRes: any;
    try {
      const observable = this.httpService.get(url, config);
      const promise = observable.toPromise();
      const response = await promise;
      return response.data;
    } catch (err) {
      console.log('findUser err', err);
      registerUserRes = { error: err };
    }
    return registerUserRes;
  }

  public async getUserKeycloakRefreshToken(data) {
    const url = `${this.keycloak_url}/realms/${this.realm_name_app}/protocol/openid-connect/token`;

    let payload = {
      client_id: this.client_name_app,
      grant_type: 'refresh_token',
      refresh_token: data.refresh_token,
    };

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    try {
      const observable = this.httpService.post(url, payload, config);
      const promise = observable.toPromise();
      const response = await promise;

      return response.data;
    } catch (e) {
      console.log('getUserKeycloakToken', e.message);
    }
  }
  public async revokeToken(
    token: string,
    tokenTypeHint: string = 'access_token',
  ) {
    const url = `${this.keycloak_url}/realms/${this.realm_name_app}/protocol/openid-connect/revoke`;

    let payload = new URLSearchParams();
    payload.append('client_id', this.client_name_app);
    payload.append('client_secret', this.keycloak_admin_cli_client_secret);
    payload.append('token', token);
    payload.append('token_type_hint', tokenTypeHint);

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    try {
      const observable = this.httpService.post(url, payload.toString(), config);
      const response = await lastValueFrom(observable);
      return response.data;
    } catch (error) {
      console.error('Error revoking token:', error.message);
      throw new HttpException(
        'TOKEN_REVOCATION_FAILED',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async updateUser(
    userId: string,
    updatedData: { [key: string]: any },
  ): Promise<{ [key: string]: any }> {
    try {
      // Get Keycloak admin access token
      const adminResultData = await this.getAdminKeycloakToken();

      if (adminResultData?.access_token) {
        // Keycloak URL to update user
        const url = `${this.keycloak_url}/admin/realms/${this.realm_name_app}/users/${userId}`;

        // Make HTTP PUT request to update the user
        const { status, data } = await lastValueFrom(
          this.httpService
            .put(url, updatedData, {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminResultData.access_token}`,
              },
            })
            .pipe(map((res) => res)),
        );

        return {
          status,
          data,
          message:
            status === 204
              ? 'User updated successfully'
              : 'Failed to update user',
        };
      } else {
        throw new BadRequestException('Error while fetching admin token!');
      }
    } catch (error) {
      console.error('Error updating user:', error.message);
      throw new HttpException(error.message, HttpStatus.CONFLICT, {
        cause: error,
      });
    }
  }
}
