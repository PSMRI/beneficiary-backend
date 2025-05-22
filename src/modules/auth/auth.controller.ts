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
  @ApiBody({ type: RegisterDTO })
  @ApiResponse({ status: 200, description: 'User registered successfully.' })
  @ApiResponse({ status: 409, description: 'Mobile number already exists.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  public async registerWithUsernamePassword(@Body() body: RegisterDTO) {
    return await this.authService.registerWithUsernamePassword(body);
  }

  @Post('/login')
  @UsePipes(new ValidationPipe())
  @ApiBody({ type: LoginDTO })
  public async login(@Body() body: LoginDTO) {
    return await this.authService.login(body);
  }

  @Post('/logout')
  @UsePipes(ValidationPipe)
  logout(@Req() req: Request, @Res() response: Response) {
    return this.authService.logout(req, response);
  }
}
