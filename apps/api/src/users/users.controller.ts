import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type {
  AdminUserRow,
  CreateUserBody,
  ResetPasswordBody,
  UpdateUserBody,
  UserCatalogRow,
} from '@support-ticketing/shared';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { RequireRole } from '../auth/require-role.decorator';
import { requireUser } from '../auth/require-user';
import { adminIncludeDeleted } from '../http/admin-include-deleted';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequireRole('supervisor')
  list(
    @Req() request: AuthenticatedRequest,
    @Query('includeDeleted') includeDeleted?: string,
  ): Promise<UserCatalogRow[] | AdminUserRow[]> {
    const user = requireUser(request);
    return this.usersService.listCatalog({
      includeDeleted: adminIncludeDeleted(includeDeleted, user.role),
    });
  }

  @Post()
  @RequireRole('admin')
  create(@Body() body: CreateUserBody): Promise<AdminUserRow> {
    return this.usersService.create(body);
  }

  @Patch(':id/password')
  @RequireRole('admin')
  resetPassword(
    @Param('id') id: string,
    @Body() body: ResetPasswordBody,
  ): Promise<AdminUserRow> {
    return this.usersService.resetPassword(id, body);
  }

  @Patch(':id')
  @RequireRole('admin')
  update(
    @Param('id') id: string,
    @Body() body: UpdateUserBody,
  ): Promise<AdminUserRow> {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  @RequireRole('admin')
  softDelete(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<AdminUserRow> {
    const actor = requireUser(request);
    return this.usersService.softDelete(id, actor.id);
  }

  @Post(':id/restore')
  @RequireRole('admin')
  restore(@Param('id') id: string): Promise<AdminUserRow> {
    return this.usersService.restore(id);
  }
}
