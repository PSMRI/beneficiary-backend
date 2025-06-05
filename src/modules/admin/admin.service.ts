import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';
import { SuccessResponse } from 'src/common/responses/success-response';
import { ErrorResponse } from 'src/common/responses/error-response';

interface ConfigMapping {
	key: string;
	value: any;
}

@Injectable()
export class AdminService {
	constructor(
		@InjectRepository(Setting)
		private settingRepository: Repository<Setting>,
	) {}

	async createOrUpdateConfig(
		mapping: ConfigMapping,
		userId: string,
	): Promise<SuccessResponse | ErrorResponse> {
		try {
			// Check if setting with this key exists
			const existingSetting = await this.settingRepository.findOne({
				where: { key: mapping.key },
			});

			let savedMapping;
			if (existingSetting) {
				// Update existing setting
				existingSetting.value = mapping.value;
				existingSetting.updatedBy = userId;
				savedMapping = await this.settingRepository.save(existingSetting);
				Logger.debug('Updated existing mapping:', savedMapping);
			} else {
				// Create new setting
				const newMapping = this.settingRepository.create({
					key: mapping.key,
					value: mapping.value,
					createdBy: userId,
					updatedBy: userId,
				});
				savedMapping = await this.settingRepository.save(newMapping);
			}

			return new SuccessResponse({
				statusCode: HttpStatus.OK,
				message: 'Config saved successfully.',
				data: savedMapping,
			});
		} catch (error) {
			Logger.error('Error saving mapping:', error);
			return new ErrorResponse({
				statusCode: HttpStatus.NOT_FOUND,
				errorMessage: error.message,
			});
		}
	}

	async getConfig(key: string): Promise<SuccessResponse | ErrorResponse> {
		try {
			const setting = await this.settingRepository.findOne({
				where: { key },
				order: { created: 'DESC' },
			});

			if (!setting) {
				return new ErrorResponse({
					statusCode: HttpStatus.NOT_FOUND,
					errorMessage: `No setting found with key: ${key}`,
				});
			}
			return new SuccessResponse({
				statusCode: HttpStatus.OK,
				message: 'Config retrieved successfully',
				data: setting,
			});
		} catch (error) {
			Logger.error('Error in getConfig:', error);
			return new ErrorResponse({
				statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
				errorMessage:
					'An unexpected error occurred while retrieving the configuration',
			});
		}
	}
}
