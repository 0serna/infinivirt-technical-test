import { Body, Controller, Get, Post } from '@nestjs/common';
import type { CreateUserBody, UserCatalogRow } from '@support-ticketing/shared';
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
}
