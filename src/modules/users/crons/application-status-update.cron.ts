import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UserService } from '../users.service';

@Injectable()
export class ApplicationStatusUpdate {
	constructor(
		private readonly userService: UserService,
	) {}

	@Cron('*/15 * * * *')
	async updateApplicationStatusCron() {
		try {
			Logger.log('Starting application status update cron job');
			
			// Use the service method to update all application statuses
			const result = await this.userService.updateApplicationStatuses();
			
			Logger.log(`Application status update cron completed: ${result.message}`);
		} catch (error) {
			Logger.error(`Error in 'Update user application cron': ${error}`);
		}
	}
}
