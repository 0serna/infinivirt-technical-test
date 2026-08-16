import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService, type LoginResult } from './auth.service';
import type { LoginDto } from './login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto): Promise<LoginResult> {
    return this.authService.login(body.email, body.password);
  }
}
