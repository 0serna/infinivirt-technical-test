import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type {
  CreateUserBody,
  ResetPasswordBody,
  UpdateUserBody,
  UserCatalogRow,
} from '@support-ticketing/shared';
import { RequireRole } from '../auth/require-role.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequireRole('supervisor')
  list(): Promise<UserCatalogRow[]> {
    return this.usersService.listCatalog();
  }

  @Post()
  @RequireRole('admin')
  create(@Body() body: CreateUserBody): Promise<UserCatalogRow> {
    return this.usersService.create(body);
  }

  @Patch(':id/password')
  @RequireRole('admin')
  resetPassword(
    @Param('id') id: string,
    @Body() body: ResetPasswordBody,
  ): Promise<UserCatalogRow> {
    return this.usersService.resetPassword(id, body);
  }

  @Patch(':id')
  @RequireRole('admin')
  update(
    @Param('id') id: string,
    @Body() body: UpdateUserBody,
  ): Promise<UserCatalogRow> {
    return this.usersService.update(id, body);
  }
}
