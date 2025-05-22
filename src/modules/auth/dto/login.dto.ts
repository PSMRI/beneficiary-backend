import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class LoginDTO {
    @ApiProperty()
    @IsNotEmpty({ message: 'Username is required' })
    @IsString({ message: 'Username must be a string' })
    username: string;

    @ApiProperty()
    @IsNotEmpty({ message: 'Password is required' })
    @IsString({ message: 'Password must be a string' })
    password: string;
}