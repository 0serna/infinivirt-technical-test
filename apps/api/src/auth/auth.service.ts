import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
};

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
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException();
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException();
    }

    const accessToken = await this.jwt.signAsync({ sub: user.id });

    return {
      accessToken,
      user: this.toPublicUser(user),
    };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.toPublicUser(user);
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    displayName: string;
    role: Role;
  }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }
}
