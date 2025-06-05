import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class ConfigKeyDto {
	@IsString({ message: 'key must be a string' })
	@IsNotEmpty({ message: 'key is required' })
	@Matches(/^[a-zA-Z0-9_]+$/, { message: 'key must contain only letters, numbers, and underscores' })
	key: string;
}
