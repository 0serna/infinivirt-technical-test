import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { type PublicUser, toPublicUser } from './public-user';
import { requireLiveUser } from './require-live-user';

export type LoginResult = {
  accessToken: string;
  user: PublicUser;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      throw new UnauthorizedException();
    }

    const user = requireLiveUser(
      await this.prisma.user.findUnique({ where: { email } }),
    );

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException();
    }

    const accessToken = await this.jwt.signAsync({ sub: user.id });

    return {
      accessToken,
      user: toPublicUser(user),
    };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = requireLiveUser(
      await this.prisma.user.findUnique({ where: { id: userId } }),
    );
    return toPublicUser(user);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
