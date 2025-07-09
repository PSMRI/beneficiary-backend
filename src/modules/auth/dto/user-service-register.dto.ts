import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type as TransformType } from 'class-transformer';

export class CustomFieldDto {
  @ApiProperty({ description: 'Field ID for custom field' })
  @IsString()
  fieldId: string;

  @ApiProperty({ description: 'Value for custom field' })
  @IsString()
  value: string;
}

export class TenantCohortRoleMappingDto {
  @ApiProperty({ description: 'Tenant ID' })
  @IsString()
  tenantId: string;

  @ApiProperty({ description: 'Role ID' })
  @IsString()
  roleId: string;
}

export class UserServiceRegisterDTO {
  @ApiProperty({ description: 'First name of the user' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Last name of the user' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Gender of the user', required: false })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({ description: 'Username for the user' })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ description: 'Password for the user', required: false })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ description: 'Phone number of the user', required: false })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ description: 'Tenant ID', required: false })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: 'Role ID', required: false })
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiProperty({ description: 'Tenant cohort role mapping', type: [TenantCohortRoleMappingDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @TransformType(() => TenantCohortRoleMappingDto)
  tenantCohortRoleMapping?: TenantCohortRoleMappingDto[];

  @ApiProperty({ description: 'Custom fields', type: [CustomFieldDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @TransformType(() => CustomFieldDto)
  customFields?: CustomFieldDto[];
}
