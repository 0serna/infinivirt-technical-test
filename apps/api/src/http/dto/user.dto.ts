import { Allow, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  ROLES,
  type CreateUserBody,
  type ResetPasswordBody,
  type Role,
  type UpdateUserBody,
} from '@support-ticketing/shared';
import { Trim } from './trim';

export class CreateUserDto implements CreateUserBody {
  @Trim()
  @IsString()
  @IsNotEmpty()
  email!: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsIn(ROLES)
  role!: Role;

  @Trim()
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class UpdateUserDto implements UpdateUserBody {
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  displayName?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  @Allow()
  email?: unknown;
}

export class ResetPasswordDto implements ResetPasswordBody {
  @Trim()
  @IsString()
  @IsNotEmpty()
  password!: string;
}
