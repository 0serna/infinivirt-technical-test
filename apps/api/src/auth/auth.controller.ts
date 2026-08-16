import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard';
import { AuthService, type LoginResult, type PublicUser } from './auth.service';
import type { LoginDto } from './login.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto): Promise<LoginResult> {
    return this.authService.login(body.email, body.password);
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest): Promise<PublicUser> {
    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.authService.me(userId);
  }
}
