import { UserService } from '@modules/users/users.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorResponse } from 'src/common/responses/error-response';
import { SuccessResponse } from 'src/common/responses/success-response';
import { LoggerService } from 'src/logger/logger.service';

import { KeycloakService } from 'src/services/keycloak/keycloak.service';

const crypto = require('crypto');
const axios = require('axios');

const jwt = require('jwt-decode');
@Injectable()
export class AuthService {
  public keycloak_admin_cli_client_secret = this.configService.get<string>(
    'KEYCLOAK_ADMIN_CLI_CLIENT_SECRET',
  );

  constructor(
    private readonly configService: ConfigService,
    private readonly keycloakService: KeycloakService,
    private readonly userService: UserService,
    private readonly loggerService: LoggerService,
  ) {}

  public async login(req, response) {
    const data = {
      username: req.body.phone_number,
      password: req.body.password,
      type: 'login',
    };

    const token = await this.keycloakService.getUserKeycloakToken(data);

    if (token) {
      return new SuccessResponse({
        statusCode: HttpStatus.OK,
        message: 'LOGGEDIN_SUCCESSFULLY',
        data: token,
      });
    } else {
      return new ErrorResponse({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorMessage: 'INVALID_USERNAME_PASSWORD_MESSAGE',
      });
    }
  }

  public async register(body) {
    try {
      // Step 1: Check if mobile number exists in the database
      await this.checkMobileExistence(body?.phone_number);

      // Step 2: Prepare user data for Keycloak registration
      const dataToCreateUser = this.prepareUserData(body);

      // Step 3: Get Keycloak admin token
      const token = await this.keycloakService.getAdminKeycloakToken();
      this.validateToken(token);

      // Step 4: Register user in Keycloak
      const keycloakId = await this.registerUserInKeycloak(
        dataToCreateUser,
        token.access_token,
      );

      // Step 5: Register user in PostgreSQL
      const userData = {
        ...body,
        keycloak_id: keycloakId,
        username: dataToCreateUser.username,
      };
      const user = await this.userService.createKeycloakData(userData);

      // Step 6: Return success response
      return new SuccessResponse({
        statusCode: HttpStatus.OK,
        message: 'User created successfully',
        data: user,
      });
    } catch (error) {
      return this.handleRegistrationError(error, body?.keycloak_id);
    }
  }

  private async checkMobileExistence(phoneNumber: string) {
    if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
      throw new ErrorResponse({
        statusCode: HttpStatus.BAD_REQUEST,
        errorMessage: 'Invalid phone number format',
      });
    }
    const isMobileExist = await this.userService.findByMobile(phoneNumber);
    if (isMobileExist) {
      throw new ErrorResponse({
        statusCode: HttpStatus.CONFLICT,
        errorMessage: 'Mobile Number Already Exists',
      });
    }
  }

  private prepareUserData(body) {
    return {
      enabled: 'true',
      firstName: body?.first_name,
      lastName: body?.last_name,
      username: body.phone_number,
      credentials: [
        {
          type: 'password',
          value: body?.password,
          temporary: false,
        },
      ],
    };
  }

  private validateToken(token) {
    if (!token?.access_token) {
      throw new ErrorResponse({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorMessage: 'Unable to get Keycloak token',
      });
    }
  }

  private async registerUserInKeycloak(userData, accessToken) {
    const registerUserRes = await this.keycloakService.registerUser(
      userData,
      accessToken,
    );

    if (registerUserRes.error) {
      if (registerUserRes?.error?.response?.status === 409) {
        this.loggerService.error(
          'User already exists!',
          registerUserRes?.error,
        );
        throw new ErrorResponse({
          statusCode: HttpStatus.CONFLICT,
          errorMessage: 'User already exists!',
        });
      }
      throw new ErrorResponse({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorMessage: registerUserRes.error.message,
      });
    }

    if (registerUserRes.headers.location) {
      const locationParts = registerUserRes.headers.location.split('/');
      if (locationParts?.length === 0) {
        throw new ErrorResponse({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          errorMessage: 'Invalid location header format',
        });
      }
      const keycloakId = registerUserRes?.headers?.location.split('/').pop();
      if (!keycloakId) {
        throw new ErrorResponse({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          errorMessage: 'Unable to extract Keycloak ID',
        });
      }
      return keycloakId;
    }

    throw new ErrorResponse({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorMessage: 'Unable to create user in Keycloak',
    });
  }

  private async handleRegistrationError(error, keycloakId) {
    this.loggerService.error('Error during user registration:', error);

    if (keycloakId) {
      await this.keycloakService.deleteUser(keycloakId);
      this.loggerService.error(
        'Keycloak user deleted due to failure in PostgreSQL creation',
        error,
      );
    }

    if (error instanceof ErrorResponse) {
      return error;
    }

    return new ErrorResponse({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorMessage:
        'Error during user registration. Keycloak user has been rolled back.',
    });
  }

  public async logout(req, response) {
    const accessToken = req.body.access_token;
    const refreshToken = req.body.refresh_token; // Optional: if provided

    try {
      // Revoke the access token
      await this.keycloakService.revokeToken(accessToken);

      // Optionally, revoke the refresh token if provided
      if (refreshToken) {
        await this.keycloakService.revokeToken(refreshToken, 'refresh_token');
      }

      // Return successful logout response
      return new SuccessResponse({
        statusCode: HttpStatus.OK,
        message: 'LOGGED OUT SUCCESSFULLY',
      });
    } catch (error) {
      console.error('Error during logout:', error.message);
      return new ErrorResponse({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorMessage: 'LOGOUT_FAILED',
      });
    }
  }
}
