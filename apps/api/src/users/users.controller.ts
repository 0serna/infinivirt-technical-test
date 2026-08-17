import { Controller, Get } from '@nestjs/common';
import type { UserCatalogRow } from '@support-ticketing/shared';
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
}
