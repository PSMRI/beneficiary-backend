import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested, IsArray, IsOptional, IsString, IsEnum } from 'class-validator';

export class CustomFieldInUserServiceDto {
  @ApiProperty()
  @IsString()
  fieldId: string;

  @ApiProperty()
  @IsString()
  value: string;
}

export class UpdateUserInUserServiceDto {
  @ApiProperty()
  @IsString()
  username: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  lastName: string;

  @ApiProperty({ enum: ['male', 'female', 'other'] })
  @IsEnum(['male', 'female', 'other'])
  gender: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  role: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  dob: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  email: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  district: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  state: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  address: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  pincode: string;

  @ApiProperty()
  @IsString()
  updatedBy: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  status: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  reason: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  deviceId: string;

  @ApiProperty({ enum: ['add', 'update', 'delete'] })
  @IsOptional()
  @IsEnum(['add', 'update', 'delete'])
  action?: string;

  @ApiProperty({ type: [CustomFieldInUserServiceDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFieldInUserServiceDto)
  @IsOptional()
  customFields?: CustomFieldInUserServiceDto[];
}