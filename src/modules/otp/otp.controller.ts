import { Body, Controller, Post, Res } from '@nestjs/common';
import { OtpService } from './otp.service';

@Controller('otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('/send_otp')
  async sendOTP(@Body() number: any, @Res() res: any) {
    const response = await this.otpService.sendOTP(number);
    return res.status(response.statusCode).json(response);
  }

  @Post('/verify_otp')
  async veirfyOTP(@Body() otpBody: any, @Res() res: any) {
    const response = await this.otpService.verifyOTP(otpBody);
    return res.status(response.statusCode).json(response);
  }
}
