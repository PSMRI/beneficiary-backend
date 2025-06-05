import {
	Controller,
	Post,
	Body,
	UseGuards,
	Request,
	Get,
	Param,
	HttpStatus,
	BadRequestException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ConfigKeyDto } from './dto';
import { AuthGuard } from '@modules/auth/auth.guard';
import { validate } from 'class-validator';

@Controller('admin')
export class AdminController {
	constructor(private readonly adminService: AdminService) {}

	@Post('config')
	@UseGuards(AuthGuard)
	async createOrUpdateConfig(@Body() body: any, @Request() req) {
		// Validate key field
		const keyDto = new ConfigKeyDto();
		keyDto.key = body.key;

		// Validate the key field
		const errors = await validate(keyDto);
		if (errors.length > 0) {
			throw new BadRequestException({
				statusCode: HttpStatus.BAD_REQUEST,
				error: errors.map((error) =>
					Object.values(error.constraints).join(', '),
				),
			});
		}

		return await this.adminService.createOrUpdateConfig(
			{ key: body.key, value: body.value },
			req.user.keycloak_id,
		);
	}

	@Get('config/:key')
	@UseGuards(AuthGuard)
	async getConfig(@Param() params: ConfigKeyDto) {
		return await this.adminService.getConfig(params.key);
	}
}
