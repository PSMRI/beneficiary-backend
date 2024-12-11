import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateUserInfoDto {
  // @IsUUID()
  // @ApiProperty()
  user_id: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  fatherName?: string;

  @ApiProperty()
  @IsOptional()
  samagraId?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  currentSchoolName?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  currentSchoolAddress?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  currentSchoolDistrict?: string;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  class?: number;

  @ApiProperty()
  @IsOptional()
  previousYearMarks?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  studentType?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  aadhaar?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  caste?: string;

  @ApiProperty()
  @IsOptional()
  annualIncome?: number;

  @ApiProperty()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  age?: number;

  @ApiProperty()
  @IsOptional()
  @IsString()
  disabilityStatus?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  bankAccountHolderName?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  bankIfscCode?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  dob?: string;
}
