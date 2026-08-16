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
import { AuthService, type LoginResult } from './auth.service';
import type { PublicUser } from './public-user';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(
    @Body() body: { email: string; password: string },
  ): Promise<LoginResult> {
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
