import {
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User } from '../../entity/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUserDocDTO } from './dto/user_docs.dto';
import { UserDoc } from '@entities/user_docs.entity';
import { CreateUserInfoDto } from './dto/create-user-info.dto';
import { UserInfo } from '@entities/user_info.entity';
import { EncryptionService } from 'src/common/helper/encryptionService';
import { Consent } from '@entities/consent.entity';
import { CreateConsentDto } from './dto/create-consent.dto';
import { UserApplication } from '@entities/user_applications.entity';
import { CreateUserApplicationDto } from './dto/create-user-application-dto';
import { KeycloakService } from '@services/keycloak/keycloak.service';
import { SuccessResponse } from 'src/common/responses/success-response';
import { ErrorResponse } from 'src/common/responses/error-response';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentListProvider } from 'src/common/helper/DocumentListProvider';
import ProfilePopulator from 'src/common/helper/profileUpdate/profile-update';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserDoc)
    private readonly userDocsRepository: Repository<UserDoc>,
    @InjectRepository(UserInfo)
    private readonly userInfoRepository: Repository<UserInfo>,
    private readonly encryptionService: EncryptionService,
    @InjectRepository(Consent)
    private readonly consentRepository: Repository<Consent>,
    @InjectRepository(UserApplication)
    private readonly userApplicationRepository: Repository<UserApplication>,
    private readonly keycloakService: KeycloakService,
    private readonly profilePopulator: ProfilePopulator,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const user = this.userRepository.create(createUserDto);
    try {
      const savedUser = await this.userRepository.save(user);

      return new SuccessResponse({
        statusCode: HttpStatus.OK, // Created
        message: 'User created successfully.',
        data: savedUser,
      });
    } catch (error) {
      return new ErrorResponse({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR, // Created
        errorMessage: error.message,
      });
    }
  }

  async update(userId: string, updateUserDto: any) {
    // Destructure userInfo from the payload
    const { userInfo, ...userData } = updateUserDto;

    // Check for existing user in the user table
    const existingUser = await this.userRepository.findOne({
      where: { user_id: userId },
    });

    if (!existingUser) {
      return new ErrorResponse({
        statusCode: HttpStatus.NOT_FOUND,
        errorMessage: `User with ID '${userId}' not found`,
      });
    }

    // Update the user information in userRepository
    Object.assign(existingUser, userData);

    try {
      const updatedUser = await this.userRepository.save(existingUser);

      // Check for existing user info in userInfoRepository
      const existingUserInfo = await this.userInfoRepository.findOne({
        where: { user_id: userId },
      });

      if (existingUserInfo) {
        // Update user info if it exists
        Object.assign(existingUserInfo, userInfo);
        await this.userInfoRepository.save(existingUserInfo);
      } else if (userInfo) {
        // Create a new user info if it doesn't exist and userInfo is provided
        const newUserInfo = this.userInfoRepository.create({
          user_id: userId,
          ...userInfo,
        });
        await this.userInfoRepository.save(newUserInfo);
      }

      return new SuccessResponse({
        statusCode: HttpStatus.OK,
        message: 'User and associated info updated successfully',
        data: {
          ...updatedUser,
          userInfo: userInfo || existingUserInfo, // Combine updated user with userInfo
        },
      });
    } catch (error) {
      return new ErrorResponse({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorMessage: error.message || 'An error occurred while updating user',
      });
    }
  }

  async findOne(req: any, decryptData?: boolean) {
    try {
      const sso_id = req?.user?.keycloak_id;
      if (!sso_id) {
        return new ErrorResponse({
          statusCode: HttpStatus.UNAUTHORIZED,
          errorMessage: 'Invalid or missing Keycloak ID',
        });
      }

      const userDetails = await this.userRepository.findOne({
        where: { sso_id },
      });

      if (!userDetails) {
        return new ErrorResponse({
          statusCode: HttpStatus.NOT_FOUND,
          errorMessage: `User with ID '${sso_id}' not found`,
        });
      }

      const user = await this.findOneUser(userDetails.user_id);
      const userInfo = await this.findOneUserInfo(
        userDetails.user_id,
        decryptData,
      );
      const userDoc = await this.findUserDocs(userDetails.user_id, decryptData);

      const final = {
        ...user,
        ...userInfo,
        docs: userDoc || [],
      };
      return new SuccessResponse({
        statusCode: HttpStatus.OK,
        message: 'User retrieved successfully.',
        data: final,
      });
    } catch (error) {
      return new ErrorResponse({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorMessage: error.message,
      });
    }
  }

  async findConsentByUser(req: any) {
    try {
      const sso_id = req?.user?.keycloak_id;
      if (!sso_id) {
        return new ErrorResponse({
          statusCode: HttpStatus.UNAUTHORIZED,
          errorMessage: 'Invalid or missing Keycloak ID',
        });
      }

      const userDetails = await this.userRepository.findOne({
        where: { sso_id },
      });

      if (!userDetails) {
        return new ErrorResponse({
          statusCode: HttpStatus.NOT_FOUND,
          errorMessage: `User with ID '${sso_id}' not found`,
        });
      }

      const consent = await this.findUserConsent(userDetails.user_id);

      const final = {
        ...consent,
      };
      return new SuccessResponse({
        statusCode: HttpStatus.OK,
        message: 'User consent retrieved successfully.',
        data: final,
      });
    } catch (error) {
      return new ErrorResponse({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorMessage: error.message,
      });
    }
  }

  async findOneUser(user_id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { user_id },
    });

    return user;
  }

  async findOneUserInfo(
    user_id: string,
    decryptData: boolean,
  ): Promise<UserInfo> {
    const userInfo = await this.userInfoRepository.findOne({
      where: { user_id },
    });
    if (
      userInfo &&
      decryptData &&
      userInfo?.aadhaar &&
      typeof userInfo.aadhaar === 'string' &&
      userInfo.aadhaar.includes(':')
    ) {
      const decrypted = this.encryptionService.decrypt(userInfo?.aadhaar);

      userInfo.aadhaar = decrypted;
    }

    return userInfo;
  }

  async findUserDocs(user_id: string, decryptData: boolean) {
    const userDocs = await this.userDocsRepository.find({ where: { user_id } });

    // Retrieve the document subtypes set from the DocumentListProvider
    const documentTypes = DocumentListProvider.getDocumentSubTypesSet();

    if (decryptData) {
      return userDocs.map((doc) => ({
        ...doc,
        doc_data: this.encryptionService.decrypt(doc.doc_data),
        is_uploaded: documentTypes.has(doc.doc_subtype),
      }));
    }

    return userDocs;
  }

  async findUserConsent(user_id: string): Promise<any> {
    const consents = await this.consentRepository.find({
      where: { user_id },
    });

    // Format the response
    return {
      statusCode: 200,
      message: 'User consent retrieved successfully.',
      data: consents.map((consent) => ({
        id: consent.id,
        user_id: consent.user_id,
        purpose: consent.purpose,
        purpose_text: consent.purpose_text,
        accepted: consent.accepted,
        consent_date: consent.consent_date,
      })),
    };
  }

  /*async remove(user_id: string): Promise<void> {
    const userWithInfo = await this.findOne(user_id);

    const user = userWithInfo.user;

    await this.userRepository.remove(user);
  }*/

  // Method to check if mobile number exists
  async findByMobile(mobile: string): Promise<User | undefined> {
    return await this.userRepository.findOne({
      where: { phoneNumber: mobile },
    });
  }

  async findByUsername(username: string): Promise<User | undefined> {
    return await this.userRepository.findOne({
      where: { phoneNumber: username },
    });
  }

  async createKeycloakData(body: any): Promise<User> {
    const user = this.userRepository.create({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || '',
      phoneNumber: body.phoneNumber || '',
      sso_provider: 'keycloak',
      sso_id: body.keycloak_id,
      created_at: new Date(),
    });
    return await this.userRepository.save(user);
  }
  // User docs save
  async createUserDoc(createUserDocDto: CreateUserDocDTO) {
    try {
      if (
        createUserDocDto.doc_data &&
        typeof createUserDocDto.doc_data !== 'string'
      ) {
        const jsonDataString = JSON.stringify(createUserDocDto.doc_data);

        // Encrypt the JSON string
        createUserDocDto.doc_data =
          this.encryptionService.encrypt(jsonDataString);
      }

      // Ensure doc_data is always a string when calling create
      const newUserDoc = this.userDocsRepository.create({
        ...createUserDocDto,
        doc_data: createUserDocDto.doc_data as string,
      });

      const savedUserDoc = await this.userDocsRepository.save(newUserDoc);
      return new SuccessResponse({
        statusCode: HttpStatus.OK,
        message: 'User docs added to DB successfully.',
        data: savedUserDoc,
      });
    } catch (error) {
      if (error.code == '23505') {
        return new ErrorResponse({
          statusCode: HttpStatus.BAD_REQUEST,
          errorMessage: error.detail,
        });
      }
      return new ErrorResponse({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorMessage: error,
      });
    }
  }

  async getDoc(createUserDocDto: CreateUserDocDTO) {
    const existingDoc = await this.userDocsRepository.findOne({
      where: {
        user_id: createUserDocDto.user_id,
        doc_type: createUserDocDto.doc_type,
        doc_subtype: createUserDocDto.doc_subtype,
      },
    });

    return existingDoc;
  }

  async saveDoc(createUserDocDto: CreateUserDocDTO) {
    const newUserDoc = this.userDocsRepository.create({
      ...createUserDocDto,
      doc_data: createUserDocDto.doc_data as string,
    });

    // Save to the database
    const savedDoc = await this.userDocsRepository.save(newUserDoc);
    return savedDoc;
  }

  async writeToFile(
    createUserDocDto: CreateUserDocDTO,
    userFilePath: any,
    savedDoc: any,
  ) {
    try {
      // Initialize the file with empty array if it doesn't exist
      let currentData = [];
      if (fs.existsSync(userFilePath)) {
        try {
          currentData = JSON.parse(fs.readFileSync(userFilePath, 'utf-8'));
        } catch (err) {
          console.error('Error reading/parsing file, reinitializing:', err);
        }
      }

      currentData.push(savedDoc);

      // Write the updated data to the file
      fs.writeFileSync(userFilePath, JSON.stringify(currentData, null, 2));
      console.log(
        `File written successfully for user_id: ${createUserDocDto.user_id}`,
      );
    } catch (err) {
      console.error('Error writing to file:', err);
    }
  }

  async getSavedAndExistingDocs(
    createUserDocsDto: CreateUserDocDTO[],
    baseFolder: any,
  ) {
    const savedDocs: UserDoc[] = [];
    const existingDocs: UserDoc[] = [];

    for (const createUserDocDto of createUserDocsDto) {
      const userFilePath = path.join(
        baseFolder,
        `${createUserDocDto.user_id}.json`,
      );

      // Check if a record with the same user_id, doc_type, and doc_subtype exists in DB
      const existingDoc = await this.getDoc(createUserDocDto);

      if (existingDoc) {
        existingDocs.push(existingDoc);
        console.log(
          `Document already exists for user_id: ${createUserDocDto.user_id}, doc_type: ${createUserDocDto.doc_type}, doc_subtype: ${createUserDocDto.doc_subtype}`,
        );
      } else {
        if (
          createUserDocDto.doc_data &&
          typeof createUserDocDto.doc_data !== 'string'
        ) {
          const jsonDataString = JSON.stringify(createUserDocDto.doc_data);

          // Encrypt the JSON string
          createUserDocDto.doc_data =
            this.encryptionService.encrypt(jsonDataString);
        }

        // Create the new document entity for the database
        const savedDoc = await this.saveDoc(createUserDocDto);
        savedDocs.push(savedDoc);

        await this.writeToFile(createUserDocDto, userFilePath, savedDoc);
      }
    }

    return { savedDocs, existingDocs };
  }

  async createUserDocs(
    createUserDocsDto: CreateUserDocDTO[],
  ): Promise<UserDoc[]> {
    const baseFolder = path.join(__dirname, 'userData'); // Base folder for storing user files

    // Ensure the `userData` folder exists
    if (!fs.existsSync(baseFolder)) {
      fs.mkdirSync(baseFolder, { recursive: true });
    }

    const { savedDocs, existingDocs } = await this.getSavedAndExistingDocs(
      createUserDocsDto,
      baseFolder,
    );

    if (existingDocs.length > 0) return existingDocs;

    return savedDocs;
  }

  async getUserDetails(req: any) {
    const sso_id = req?.user?.keycloak_id;
    if (!sso_id) {
      throw new UnauthorizedException('Invalid or missing Keycloak ID');
    }

    const userDetails = await this.userRepository.findOne({
      where: { sso_id },
    });

    if (!userDetails) {
      throw new NotFoundException(`User with ID '${sso_id}' not found`);
    }

    return userDetails;
  }

  async updateProfile(userDetails: any) {
    try {
      // Get all docs
      const allDocs = await this.userDocsRepository.find({
        where: { user_id: userDetails.user_id },
      });

      // Build VCs
      const VCs = await this.profilePopulator.buildVCs(allDocs);

      // // build profile data
      const { userProfile, validationData } =
        await this.profilePopulator.buildProfile(VCs);

      // Update database entries
      await this.profilePopulator.updateDatabase(
        userProfile,
        validationData,
        userDetails,
      );
    } catch (error) {
      Logger.error('Error in updating fields: ', error);
      throw new InternalServerErrorException(
        'An unexpected error occurred while updating profile.',
      );
    }
  }

  async createUserDocsNew(
    req,
    createUserDocsDto: CreateUserDocDTO[],
  ): Promise<UserDoc[]> {
    const userDetails = await this.getUserDetails(req);

    const baseFolder = path.join(__dirname, 'userData'); // Base folder for storing user files

    const savedDocs: UserDoc[] = [];
    const existingDocs: UserDoc[] = [];

    // Ensure the `userData` folder exists
    if (!fs.existsSync(baseFolder)) {
      fs.mkdirSync(baseFolder, { recursive: true });
    }

    for (const createUserDocDto of createUserDocsDto) {
      const userFilePath = path.join(
        baseFolder,
        `${createUserDocDto.user_id}.json`,
      );

      // Check if a record with the same user_id, doc_type, and doc_subtype exists in DB
      const existingDoc = await this.userDocsRepository.findOne({
        where: {
          user_id: userDetails.user_id,
          doc_type: createUserDocDto.doc_type,
          doc_subtype: createUserDocDto.doc_subtype,
        },
      });

      if (existingDoc) {
        existingDocs.push(existingDoc);
        console.log(
          `Document already exists for user_id: ${createUserDocDto.user_id}, doc_type: ${createUserDocDto.doc_type}, doc_subtype: ${createUserDocDto.doc_subtype}`,
        );
      } else {
        if (
          createUserDocDto.doc_data &&
          typeof createUserDocDto.doc_data !== 'string'
        ) {
          const jsonDataString = JSON.stringify(createUserDocDto.doc_data);

          // Encrypt the JSON string
          createUserDocDto.doc_data =
            this.encryptionService.encrypt(jsonDataString);
        }
        if (!createUserDocDto?.user_id) {
          createUserDocDto.user_id = userDetails?.user_id;
        }

        // Create the new document entity for the database
        const savedDoc = await this.saveDoc(createUserDocDto);
        savedDocs.push(savedDoc);

        await this.writeToFile(createUserDocDto, userFilePath, savedDoc);
      }
    }

    // Update profile based on documents
    await this.updateProfile(userDetails);

    if (existingDocs.length > 0) {
      return existingDocs;
    }
    return savedDocs;
  }
  // User info
  async createUserInfo(
    createUserInfoDto: CreateUserInfoDto,
  ): Promise<UserInfo | null> {
    try {
      // Ensure you await the result of registerUserWithUsername
      const userData = await this.registerUserWithUsername(createUserInfoDto);

      // Check if userData and userData.user exist
      if (userData?.user?.user_id) {
        // Assign the user_id from userData to createUserInfoDto
        createUserInfoDto.user_id = userData.user.user_id;

        // Encrypt the aadhaar before saving
        const encrypted = this.encryptionService.encrypt(
          createUserInfoDto.aadhaar,
        );
        createUserInfoDto.aadhaar = encrypted;

        // Create and save the new UserInfo record
        const userInfo = this.userInfoRepository.create(createUserInfoDto);
        return await this.userInfoRepository.save(userInfo);
      } else {
        // Handle the case where userData or userData.user is null
        console.error('User registration failed or returned invalid data.');
        return null;
      }
    } catch (error) {
      console.error('Error while creating user info:', error);
      throw new Error('Could not create user info');
    }
  }

  async updateUserInfo(
    user_id: string,
    updateUserInfoDto: CreateUserInfoDto,
  ): Promise<UserInfo> {
    const userInfo = await this.userInfoRepository.findOne({
      where: { user_id },
    });

    if (updateUserInfoDto?.aadhaar) {
      const encrypted = this.encryptionService.encrypt(
        updateUserInfoDto?.aadhaar,
      );

      updateUserInfoDto.aadhaar = encrypted;
    }
    Object.assign(userInfo, updateUserInfoDto);
    console.log('userInfo--->>', userInfo);
    return this.userInfoRepository.save(userInfo);
  }
  // Create a new consent record
  async createUserConsent(
    createConsentDto: CreateConsentDto,
  ): Promise<Consent> {
    const consent = this.consentRepository.create(createConsentDto);
    return await this.consentRepository.save(consent);
  }
  async createUserApplication(
    createUserApplicationDto: CreateUserApplicationDto,
  ) {
    try {
      const encrypted = this.encryptionService.encrypt(
        createUserApplicationDto.application_data,
      );
      createUserApplicationDto.application_data = { encrypted };
      const userApplication = this.userApplicationRepository.create(
        createUserApplicationDto,
      );
      const response = await this.userApplicationRepository.save(
        userApplication,
      );
      return new SuccessResponse({
        statusCode: HttpStatus.OK,
        message: 'User application created successfully.',
        data: response,
      });
    } catch (error) {
      return new ErrorResponse({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorMessage: 'Failed to create user application',
      });
    }
  }

  async findOneUserApplication(internal_application_id: string) {
    const userApplication = await this.userApplicationRepository.findOne({
      where: { internal_application_id },
    });
    if (!userApplication) {
      throw new NotFoundException(
        `Application with ID '${internal_application_id}' not found`,
      );
    }
    const decrypted = this.encryptionService.decrypt(
      userApplication?.application_data?.encrypted,
    );
    userApplication.application_data = decrypted;
    return new SuccessResponse({
      statusCode: HttpStatus.OK,
      message: 'User application retrieved successfully.',
      data: userApplication,
    });
  }

  async findAllApplicationsByUserId(requestBody: {
    filters?: any;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const whereClause = {};
    try {
      const filterKeys = this.userApplicationRepository.metadata.columns.map(
        (column) => column.propertyName,
      );
      const { filters = {}, search, page = 1, limit = 10 } = requestBody;

      // Handle filters
      if (filters && Object.keys(filters).length > 0) {
        for (const [key, value] of Object.entries(filters)) {
          if (
            filterKeys.includes(key) &&
            value !== null &&
            value !== undefined
          ) {
            whereClause[key] = value;
          }
        }
      }

      // Handle search for `application_name`
      if (search && search.trim().length > 0) {
        const sanitizedSearch = search.replace(/[%_]/g, '\\$&');
        whereClause['application_name'] = ILike(`%${sanitizedSearch}%`);
      }

      // Fetch data with pagination
      const [userApplication, total] =
        await this.userApplicationRepository.findAndCount({
          where: whereClause,
          skip: (page - 1) * limit,
          take: limit,
        });

      // Decrypt data in parallel
      if (userApplication.length > 0) {
        await Promise.all(
          userApplication.map(async (item) => {
            try {
              const decrypted = this.encryptionService.decrypt(
                item?.application_data?.encrypted,
              );
              item.application_data = decrypted;
            } catch (decryptionError) {
              console.error('Error decrypting data:', decryptionError);
            }
          }),
        );
      }

      return new SuccessResponse({
        statusCode: HttpStatus.OK,
        message: 'User applications list retrieved successfully.',
        data: { applications: userApplication, total },
      });
    } catch (error) {
      return new ErrorResponse({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errorMessage: 'Failed to fetch user applications',
      });
    }
  }

  public async registerUserWithUsername(body) {
    // Replace spaces with underscores in first name and last name
    const firstPartOfFirstName = body?.firstName
      ?.split(' ')[0]
      ?.replace(/\s+/g, '_');
    const lastNameWithUnderscore = body?.lastName?.replace(/\s+/g, '_');

    // Extract the last 2 digits of Aadhar
    const lastTwoDigits = body?.aadhaar?.slice(-2);

    // Concatenate the processed first name, last name, and last 2 digits of Aadhar
    const username =
      firstPartOfFirstName?.toLowerCase() +
      '_' +
      lastNameWithUnderscore?.toLowerCase() +
      lastTwoDigits;

    const data_to_create_user = {
      enabled: 'true',
      firstName: body?.firstName,
      lastName: body?.lastName,
      username: username,
      credentials: [
        {
          type: 'password',
          value: body?.password,
          temporary: false,
        },
      ],
    };

    // Step 3: Get Keycloak admin token
    const token = await this.keycloakService.getAdminKeycloakToken();

    try {
      // Step 4: Register user in Keycloak
      const registerUserRes = await this.keycloakService.registerUser(
        data_to_create_user,
        token.access_token,
      );

      if (registerUserRes.error) {
        if (
          registerUserRes.error.message == 'Request failed with status code 409'
        ) {
          console.log('User already exists!');
        } else {
          console.log(registerUserRes.error.message);
        }
      } else if (registerUserRes.headers.location) {
        const split = registerUserRes.headers.location.split('/');
        const keycloak_id = split[split.length - 1];
        body.keycloak_id = keycloak_id;
        body.username = data_to_create_user.username;

        // Step 5: Try to create user in PostgreSQL
        const result = await this.createKeycloakData(body);

        // If successful, return success response
        const userResponse = {
          user: result,
          keycloak_id: keycloak_id,
          username: data_to_create_user.username,
        };
        return userResponse;
      } else {
        console.log('Unable to create user in Keycloak');
      }
    } catch (error) {
      console.error('Error during user registration:', error);

      // Step 6: Rollback - delete user from Keycloak if PostgreSQL insertion fails
      if (body?.keycloak_id) {
        await this.keycloakService.deleteUser(body.keycloak_id);
        console.log(
          'Keycloak user deleted due to failure in PostgreSQL creation',
        );
      }
    }
  }
}
