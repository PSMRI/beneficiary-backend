import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDTO {
  @ApiProperty({})
  @IsNotEmpty({ message: 'First name is required' })
  @IsString({ message: 'First name must be a string' })
  first_name: string;

  @ApiProperty({})
  @IsNotEmpty({ message: 'Last name is required' })
  @IsString({ message: 'Last name must be a string' })
  last_name: string;

  @ApiProperty({})
  @IsNotEmpty({ message: 'Mobile number is required' })
  @Matches(/^[5-9]\d{9}$/, {
    message:
      'Phone number must start with a digit from 5 to 9 and have 10 digits total',
  })
  phone_number: string;

  @ApiProperty({})
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).*$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;
}
