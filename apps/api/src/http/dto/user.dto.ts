import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  registerDecorator,
} from 'class-validator';
import {
  ROLES,
  type CreateUserBody,
  type ResetPasswordBody,
  type Role,
  type UpdateUserBody,
} from '@support-ticketing/shared';
import { Trim } from './trim';

function CannotChangeEmail() {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'cannotChangeEmail',
      target: object.constructor,
      propertyName,
      validator: {
        validate: () => false,
        defaultMessage: () => 'Email cannot be changed',
      },
    });
  };
}

export class CreateUserDto implements CreateUserBody {
  @Trim()
  @IsString()
  @IsNotEmpty()
  email!: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsIn([...ROLES])
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
  @IsIn([...ROLES])
  role?: Role;

  @ValidateIf((_, value) => value !== undefined)
  @CannotChangeEmail()
  email?: unknown;
}

export class ResetPasswordDto implements ResetPasswordBody {
  @Trim()
  @IsString()
  @IsNotEmpty()
  password!: string;
}
