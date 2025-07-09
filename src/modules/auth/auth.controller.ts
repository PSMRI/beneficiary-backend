import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDTO } from './dto/register.dto';
import { LoginDTO } from './dto/login.dto';
import { UserServiceRegisterDTO } from './dto/user-service-register.dto';
import { UserServiceLoginDTO } from './dto/user-service-login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(public authService: AuthService) {}

  // users/register on keycloak and postgres both side.
  @Post('/register')
  @UsePipes(new ValidationPipe())
  @ApiBody({ type: RegisterDTO })
  @ApiResponse({ status: 200, description: 'User registered successfully.' })
  @ApiResponse({ status: 409, description: 'Mobile number already exists.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  public async register(@Body() body: RegisterDTO) {
    return await this.authService.register(body);
  }

  @Post('/register_with_password')
  @UsePipes(new ValidationPipe())
  @ApiBody({ type: UserServiceRegisterDTO })
  @ApiResponse({ status: 201, description: 'User registered in user service successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 503, description: 'User service unavailable.' })
  public async registerInUserService(@Body() body: UserServiceRegisterDTO) {
    return await this.authService.registerInUserService(body);
  }

  @Post('/login')
  @UsePipes(new ValidationPipe())
  @ApiBody({ type: UserServiceLoginDTO })
  @ApiResponse({ status: 200, description: 'Login successful.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 503, description: 'User service unavailable.' })
  public async loginInUserService(@Body() body: UserServiceLoginDTO) {
    return await this.authService.loginInUserService(body);
  }

  @Post('/logout')
  @UsePipes(ValidationPipe)
  logout(@Req() req: Request, @Res() response: Response) {
    return this.authService.logout(req, response);
  }
}
