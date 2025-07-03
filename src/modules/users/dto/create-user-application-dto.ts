import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsIn,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserApplicationDto {
  @ApiProperty({
    description: 'Unique identifier of the user',
    type: String,
    format: 'uuid',
  })
  @IsUUID()
  user_id: string;

  @ApiProperty({
    description: 'Unique identifier for the benefit',
    type: String,
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  benefit_id: string;

  @ApiProperty({
    description: 'Benefit provider ID',
    type: String,
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  benefit_provider_id: string;

  @ApiProperty({
    description: 'Benefit provider URI',
    type: String,
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  benefit_provider_uri: string;

  @ApiProperty({
    description: 'External application ID',
    type: String,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  external_application_id: string;

  @ApiProperty({
    description: 'Application Name',
    type: String,
    required: false,
  })
  @IsOptional() // Optional
  @IsString() // Optional, if you want to validate it as a string
  application_name?: string;

  @ApiProperty({
    description: 'Status of the application',
    type: String,
    maxLength: 20,
    example: 'submitted',
  })
  @IsString()
  @IsIn(['submitted', 'approved', 'rejected'])
  @IsNotEmpty()
  status: string;

  @ApiProperty({
    example: '{}',
    description: 'Application data',
    required: false,
  })
  @IsOptional() // Optional
  application_data?: any;  // Can be object, array, or null
}
