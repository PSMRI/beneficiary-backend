import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  IsOptional,
} from 'class-validator';

export class RegisterDTO {
  @ApiProperty({})
  @IsNotEmpty({ message: 'First name is required' })
  @IsString({ message: 'First name must be a string' })
  firstName: string;

  @ApiProperty({})
  @IsNotEmpty({ message: 'Last name is required' })
  @IsString({ message: 'Last name must be a string' })
  lastName: string;

  @ApiProperty({})
  @IsNotEmpty({ message: 'Mobile number is required' })
  @Matches(/^[5-9]\d{9}$/, {
    message:
      'Phone number must start with a digit from 5 to 9 and have 10 digits total',
  })
  phoneNumber: string;

  @ApiProperty({})
  @IsOptional()
  // @ValidateIf((obj) => obj.password !== undefined && obj.password !== null)
  // @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(4, { message: 'Password must be at least 4 characters long' })
  // @Matches(
  //   /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
  //   {
  //     message:
  //       'Password must contain uppercase, lowercase, number, and special character',
  //   },
  // )
  password: string;
}
