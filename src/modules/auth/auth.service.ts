import { UserService } from '@modules/users/users.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorResponse } from 'src/common/responses/error-response';
import { SuccessResponse } from 'src/common/responses/success-response';
import { LoggerService } from 'src/logger/logger.service';

import { KeycloakService } from 'src/services/keycloak/keycloak.service';
import { LoginDTO } from './dto/login.dto';
import { UserServiceRegisterDTO } from './dto/user-service-register.dto';
import { UserServiceResponse } from './dto/user-service-register.response';
import axios from 'axios';
import { UserServiceLoginDTO } from './dto/user-service-login.dto';
import { UserServiceLoginResponse } from './dto/user-service-login.response';

const crypto = require('crypto');

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
  ) { }

  public async login(body: LoginDTO) {

    const token = await this.keycloakService.getUserKeycloakToken(body);

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
      // let wallet_api_url = process.env.WALLET_API_URL;
      // Step 1: Check if mobile number exists in the database
      await this.checkMobileExistence(body?.phoneNumber);

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
      const user = {}
      // await this.userService.createKeycloakData(userData);

      /*
      if (user) {
        //create user payload
        let wallet_user_payload = {
          firstName: user?.firstName,
          lastName: user?.lastName,
          sso_provider: user?.sso_provider,
          sso_id: user?.sso_id,
          phoneNumber: user?.phoneNumber,
        };

        await axios.post(`${wallet_api_url}/users/create`, wallet_user_payload);
      }*/

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

  public async loginInUserService(body: UserServiceLoginDTO) {
    try {
      // Get the user service API URL from environment variables
      const userServiceUrl = this.configService.get<string>('USER_SERVICE_URL');

      // Make the API call to user service
      const response : UserServiceLoginResponse = await axios.post(
        `${userServiceUrl}/user/v1/auth/login`, 
        body,
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      this.loggerService.log('User service login successful', body.username);

      // Return success response
      return new SuccessResponse({
        statusCode: HttpStatus.OK,
        message: 'Login successful',
        data: response.data
      });

    } catch (error) {
      this.loggerService.error('Error during user service login:', error);
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        return new ErrorResponse({
          statusCode: error.response.status,
          errorMessage: error.response.data?.message || 'Login failed',
        });
      } else if (error.request) {
        // The request was made but no response was received
        return new ErrorResponse({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          errorMessage: 'User service is not available',
        });
      } else {
        // Something happened in setting up the request that triggered an Error
        return new ErrorResponse({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          errorMessage: 'Error setting up user service request',
        });
      }
    }
  }

  public async registerInUserService(body: UserServiceRegisterDTO) {
    try {     
      // Get the user service API URL from environment variables
      const userServiceUrl = this.configService.get<string>('USER_SERVICE_URL');
      
      // Prepare the payload for user service - pass data as-is
      const userServicePayload = {
        firstName: body?.firstName,
        lastName: body?.lastName,
        gender: body?.gender || 'male',
        username: body?.username,
        password: body?.password,
        tenantCohortRoleMapping: body?.tenantCohortRoleMapping,
        customFields: body?.customFields
      };

      // Make the API call to user service
      const response = await axios.post(
        `${userServiceUrl}/user/v1/create`,
        userServicePayload,
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      // Type the response data for better type safety
      const responseData: UserServiceResponse = response.data;
      console.log('response.data.result.userData.userId', responseData.result.userData.userId );

      const userXref = await this.userService.createUserXref(responseData.result.userData.userId); 
      console.log('userXref', userXref);

      this.loggerService.log('User service registration successful', responseData.result.userData.userId);

      if(!userXref){
        throw new ErrorResponse({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          errorMessage: 'Unable to create user xref',
        });
      }

      // Return success response
      return new SuccessResponse({
        statusCode: HttpStatus.CREATED,
        message: 'User registered in user service successfully',
        data: responseData
      });

    } catch (error) {
      // this.loggerService.error('Error during user service registration:', error);
      console.log('Error during user service registration:', error);
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        return new ErrorResponse({
          statusCode: error.response.status,
          errorMessage: error.response.data?.message || 'User service registration failed',
        });
      } else if (error.request) {
        // The request was made but no response was received
        return new ErrorResponse({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          errorMessage: 'User service is not available',
        });
      } else {
        // Something happened in setting up the request that triggered an Error
        return new ErrorResponse({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          errorMessage: 'Error setting up user service request',
        });
      }
    }
  }

  public async registerWithUsernamePassword(body) {
    try {
      // let wallet_api_url = process.env.WALLET_API_URL;

      // Step 2: Prepare user data for Keycloak registration
      const dataToCreateUser = this.prepareUserDataV2(body);
      let { password, ...rest } = dataToCreateUser;
      let userName = dataToCreateUser.username;

      // Step 3: Get Keycloak admin token
      const token = await this.keycloakService.getAdminKeycloakToken();
      this.validateToken(token);

      // Step 4: Register user in Keycloak
      const keycloakId = await this.registerUserInKeycloak(
        rest,
        token.access_token,
      );

      // Step 5: Register user in PostgreSQL
      const userData = {
        ...body,
        keycloak_id: keycloakId,
        username: dataToCreateUser.username,
      };
      const user = {}
      // await this.userService.createKeycloakData(userData);

      /*
      if (user) {
        //create user payload
        let wallet_user_payload = {
          firstName: user?.firstName,
          lastName: user?.lastName,
          sso_provider: user?.sso_provider,
          sso_id: user?.sso_id,
          phoneNumber: user?.phoneNumber,
        };

        await axios.post(`${wallet_api_url}/users/create`, wallet_user_payload);
      }*/

      // Step 6: Return success response
      return new SuccessResponse({
        statusCode: HttpStatus.OK,
        message: 'User created successfully',
        data: { user, userName, password },
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
    const isMobileExist ={ }
    //  await this.userService.findByMobile(phoneNumber);
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
      firstName: body?.firstName,
      lastName: body?.lastName,
      username: body?.phoneNumber,
      credentials: [
        // {
        //   type: 'password',
        //   value: body?.password,
        //   temporary: false,
        // },
      ],
      attributes: {
        // Custom user attributes
        phoneNumber: '+91' + body?.phoneNumber,
        firstName: body?.firstName,
        lastName: body?.lastName,
      },
    };
  }

  private prepareUserDataV2(body) {
    const trimmedFirstName = body?.firstName?.trim();
    const trimmedLastName = body?.lastName?.trim();
    const trimmedPhoneNumber = body?.phoneNumber?.trim();
    const password =
      body?.password?.trim() ?? process.env.SIGNUP_DEFAULT_PASSWORD;

    return {
      enabled: 'true',
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      username:
        trimmedFirstName +
        '_' +
        trimmedLastName?.charAt(0) +
        '_' +
        trimmedPhoneNumber?.slice(-4),
      credentials: [
        {
          type: 'password',
          value: password,
          temporary: false,
        },
      ],
      password, // Return the password directly
      attributes: {
        // Custom user attributes
        phoneNumber: '+91' + trimmedPhoneNumber,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
      },
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
