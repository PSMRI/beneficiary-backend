import { IsUUID, IsString, IsNotEmpty, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConsentDto {
  @ApiProperty({
    description: 'User Id',
    type: String,
    format: 'uuid',
  })
  @IsUUID() // Validates that user_id is a UUID
  user_id: string;

  @ApiProperty({
    description: 'Purpose of the consent',
    type: String,
    maxLength: 255,
  })
  @IsString() // Validates that purpose is a string
  @IsNotEmpty() // Validates that purpose is not empty
  purpose: string;

  @ApiProperty({
    description: 'Detailed explanation of the consent purpose',
    type: String,
  })
  @IsString() // Validates that purpose_text is a string
  @IsNotEmpty() // Validates that purpose_text is not empty
  purpose_text: string;

  @ApiProperty({
    description: 'Indicates whether the consent was accepted',
    type: Boolean,
  })
  @IsBoolean() // Validates that accepted is a boolean
  accepted: boolean;

  // @ApiProperty({
  //   description: 'Date and time when the consent was given',
  //   type: String,
  //   format: 'date-time',
  //   required: false, // Optional since it defaults to NOW() in the database
  // })
  // @IsDate() // Validates that consent_date is a date
  // consent_date?: Date; // Optional
}
